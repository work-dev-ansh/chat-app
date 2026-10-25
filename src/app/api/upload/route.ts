import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { cloudinary } from "@/lib/cloudinary";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

/**
 * Media upload pipeline supporting images (JPEG, PNG, GIF, WEBP)
 * and videos (MP4, MOV, WEBM) up to 10MB.
 *
 * Authenticates the session, validates file constraints, and uploads to
 * Cloudinary (falling back to Base64 data URLs in local development).
 */
export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form-data payload" },
        { status: 400 },
      );
    }

    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 1. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 },
      );
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: images (JPG, PNG, GIF, WEBP) and videos (MP4, MOV, WEBM)` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isVideo = file.type.startsWith("video/");
    const mediaType = isVideo ? "video" : "image";

    // 3. Upload to Cloudinary if configured, otherwise provide high-fidelity local data URI
    const hasCloudinaryCredentials = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );

    if (hasCloudinaryCredentials) {
      const uploadResult = await new Promise<{ secure_url: string; public_id: string }>(
        (resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: isVideo ? "video" : "image",
              folder: "chat-uploads",
            },
            (error, result) => {
              if (error || !result) {
                return reject(error ?? new Error("Cloudinary upload failed"));
              }
              resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
              });
            },
          );
          uploadStream.end(buffer);
        },
      );

      return NextResponse.json({
        data: {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          type: mediaType,
          originalName: file.name,
          size: file.size,
        },
      });
    }

    // Fallback if no Cloudinary keys in environment: base64 data URI
    const base64Data = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64Data}`;

    return NextResponse.json({
      data: {
        url: dataUrl,
        type: mediaType,
        originalName: file.name,
        size: file.size,
      },
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Media upload failed" },
      { status: 500 },
    );
  }
}

