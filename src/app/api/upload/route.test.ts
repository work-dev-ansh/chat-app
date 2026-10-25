import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { requireAuth } from "@/lib/server-auth";
import { NextResponse } from "next/server";

vi.mock("@/lib/server-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/cloudinary", () => ({
  cloudinary: {
    uploader: {
      upload_stream: vi.fn(),
    },
  },
}));

describe("POST /api/upload route handler", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear Cloudinary credentials so tests default to deterministic local base64 fallback
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  it("returns HTTP 401 when the request is unauthenticated", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: You must be signed in to perform this action" },
        { status: 401 },
      ),
    });

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized: You must be signed in");
  });

  it("returns HTTP 400 when request body is not valid multipart form data", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
      },
      errorResponse: null,
    });

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "invalid" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid form-data payload");
  });

  it("returns HTTP 400 when no file is present in formData", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
      },
      errorResponse: null,
    });

    const formData = new FormData();
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("No file provided");
  });

  it("returns HTTP 400 when file size exceeds the 10MB limit", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
      },
      errorResponse: null,
    });

    // 10MB + 1 byte
    const oversizedFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });

    const formData = new FormData();
    formData.append("file", oversizedFile);

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("File size exceeds 10MB limit");
  });

  it("returns HTTP 400 when file type is not supported", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
      },
      errorResponse: null,
    });

    const unsupportedFile = new File(["malicious script"], "script.sh", {
      type: "application/x-sh",
    });

    const formData = new FormData();
    formData.append("file", unsupportedFile);

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Unsupported file type");
  });

  it("uploads a valid image using the Base64 fallback when Cloudinary is not configured", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
      },
      errorResponse: null,
    });

    const imageContent = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    const validFile = new File([imageContent], "photo.png", {
      type: "image/png",
    });

    const formData = new FormData();
    formData.append("file", validFile);

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    // In jsdom/undici environment, constructing Request with FormData converts Files to generic Blobs with name="blob".
    // We mock request.formData() to accurately return the genuine File with its original name.
    vi.spyOn(request, "formData").mockResolvedValue({
      get: (key: string) => (key === "file" ? validFile : null),
    } as unknown as FormData);

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.type).toBe("image");
    expect(body.data.originalName).toBe("photo.png");
    expect(body.data.url).toMatch(/^data:image\/png;base64,/);
    expect(body.data.size).toBe(imageContent.byteLength);
  });


  it("returns generic HTTP 500 when an unexpected internal error occurs", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
      },
      errorResponse: null,
    });

    const sampleFile = new File(["test-content"], "test.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", sampleFile);

    // Mock formData() on request to return our formData, but make arrayBuffer reject
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    vi.spyOn(request, "formData").mockResolvedValue({
      get: (key: string) => {
        if (key === "file") {
          return {
            size: 100,
            type: "image/png",
            name: "test.png",
            arrayBuffer: () => Promise.reject(new Error("Disk storage corruption at /dev/shm/media")),
          } as unknown as File;
        }
        return null;
      },
    } as unknown as FormData);

    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Media upload failed");
    expect(body.error).not.toContain("Disk storage corruption");
  });

});

