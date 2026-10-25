import { NextResponse } from "next/server";
import { conversationRepository } from "@/infrastructure/conversation-repository";
import { requireAuth } from "@/lib/server-auth";

export async function GET() {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const summaries = await conversationRepository.findSummariesForUser(user.id);

    return NextResponse.json({
      data: summaries,
    });
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * Custom error class for request-level validation failures that should return HTTP 400.
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload: expected a JSON object" },
        { status: 400 },
      );
    }

    let requestedUserIds: string[] = [];

    if ("userIds" in body) {
      if (!Array.isArray(body.userIds)) {
        throw new ValidationError("userIds must be an array of participant IDs");
      }

      // Check all elements are non-empty strings
      for (const id of body.userIds) {
        if (typeof id !== "string" || !id.trim()) {
          throw new ValidationError("All participant IDs must be non-empty strings");
        }
      }

      // Check for duplicate participant IDs in the input array before any deduplication
      const rawUserIds = body.userIds as string[];
      const seen = new Set<string>();
      for (const id of rawUserIds) {
        if (seen.has(id)) {
          throw new ValidationError("Duplicate participant IDs are not allowed");
        }
        seen.add(id);
      }

      requestedUserIds = rawUserIds;
    } else if ("peerUserId" in body) {
      if (typeof body.peerUserId !== "string" || !body.peerUserId.trim()) {
        throw new ValidationError("peerUserId must be a non-empty string");
      }
      requestedUserIds = [user.id, body.peerUserId.trim()];
    } else {
      throw new ValidationError("Either userIds array or peerUserId is required");
    }

    // Ensure session user is ALWAYS included in participants
    const allUserIds = Array.from(new Set([user.id, ...requestedUserIds]));

    if (allUserIds.length < 2) {
      throw new ValidationError("A conversation requires at least two participants");
    }

    // Validate title if present
    let title: string | undefined;
    if ("title" in body && body.title !== undefined && body.title !== null) {
      if (typeof body.title !== "string") {
        throw new ValidationError("title must be a string");
      }
      const trimmedTitle = body.title.trim();
      title = trimmedTitle.length > 0 ? trimmedTitle : undefined;
    }

    const conversation =
      await conversationRepository.createConversationWithPeer(allUserIds, title);

    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("participant")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    console.error("Failed to create conversation:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

