import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { requireAuth } from "@/lib/server-auth";
import { prisma } from "@/infrastructure/prisma";
import { NextResponse } from "next/server";

vi.mock("@/lib/server-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/infrastructure/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/users route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns HTTP 401 when the request is unauthenticated", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: You must be signed in to perform this action" },
        { status: 401 },
      ),
    });

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized: You must be signed in");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("excludes the authenticated user using session user.id and selects only approved public directory fields", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "session-user-123",
        name: "Current User",
        email: "current@example.com",
      },
      errorResponse: null,
    });

    const mockRecords = [
      {
        id: "user-alice",
        name: "Alice Johnson",
        email: "alice@example.com",
        avatarUrl: "https://example.com/avatar-alice.png",
      },
      {
        id: "user-bob",
        name: "Bob Smith",
        email: "bob@example.com",
        avatarUrl: null,
      },
    ];

    vi.mocked(prisma.user.findMany).mockResolvedValue(mockRecords as any);

    const response = await GET();

    expect(response.status).toBe(200);

    // Verify session-derived exclusion and exact field projection
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { not: "session-user-123" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
      orderBy: { name: "asc" },
    });

    const body = await response.json();
    expect(body.data).toEqual(mockRecords);
  });

  it("normalizes null or whitespace-only name values to a non-null string", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "session-user-123",
        name: "Current User",
        email: "current@example.com",
      },
      errorResponse: null,
    });

    const mockRecords = [
      {
        id: "user-null-name",
        name: null,
        email: "noname@example.com",
        avatarUrl: null,
      },
      {
        id: "user-blank-name",
        name: "   ",
        email: "blankname@example.com",
        avatarUrl: "https://example.com/blank.png",
      },
      {
        id: "user-valid-name",
        name: " Charlie Brown ",
        email: "charlie@example.com",
        avatarUrl: null,
      },
    ];

    vi.mocked(prisma.user.findMany).mockResolvedValue(mockRecords as any);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data).toEqual([
      {
        id: "user-null-name",
        name: "Unknown User",
        email: "noname@example.com",
        avatarUrl: null,
      },
      {
        id: "user-blank-name",
        name: "Unknown User",
        email: "blankname@example.com",
        avatarUrl: "https://example.com/blank.png",
      },
      {
        id: "user-valid-name",
        name: "Charlie Brown",
        email: "charlie@example.com",
        avatarUrl: null,
      },
    ]);
  });

  it("queries users ordered alphabetically by name and preserves the returned order", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "session-user-123",
        name: "Current User",
        email: "current@example.com",
      },
      errorResponse: null,
    });

    // Mock records in pre-sorted alphabetical order as returned by database
    const alphabeticalRecords = [
      {
        id: "user-alice",
        name: "Alice Adams",
        email: "alice@example.com",
        avatarUrl: null,
      },
      {
        id: "user-bob",
        name: "Bob Barker",
        email: "bob@example.com",
        avatarUrl: null,
      },
      {
        id: "user-charlie",
        name: "Charlie Clark",
        email: "charlie@example.com",
        avatarUrl: null,
      },
      {
        id: "user-zoe",
        name: "Zoe Zimmerman",
        email: "zoe@example.com",
        avatarUrl: null,
      },
    ];

    vi.mocked(prisma.user.findMany).mockResolvedValue(alphabeticalRecords as any);

    const response = await GET();

    expect(response.status).toBe(200);

    // Verify the query contract specifies ascending alphabetical ordering by name
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: "asc" },
      }),
    );

    const body = await response.json();

    // Verify route preserves exact alphabetical order returned by database
    expect(body.data).toHaveLength(4);
    expect(body.data.map((u: { name: string }) => u.name)).toEqual([
      "Alice Adams",
      "Bob Barker",
      "Charlie Clark",
      "Zoe Zimmerman",
    ]);
  });

  it("returns generic HTTP 500 when an unexpected database error occurs without exposing internal details", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "session-user-123",
        name: "Current User",
        email: "current@example.com",
      },
      errorResponse: null,
    });

    vi.mocked(prisma.user.findMany).mockRejectedValue(
      new Error("FATAL: database pg_hba.conf rejects connection for host 10.0.0.1"),
    );

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal Server Error");
    expect(body.error).not.toContain("pg_hba.conf");
    expect(body.error).not.toContain("10.0.0.1");
  });
});

