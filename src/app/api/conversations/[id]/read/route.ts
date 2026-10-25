import { NextResponse } from "next/server";
import { conversationRepository } from "@/infrastructure/conversation-repository";
import { requireAuth } from "@/lib/server-auth";

/**
 * POST /api/conversations/[id]/read
 * Updates the user's membership lastReadAt timestamp, resetting persistent unread count to 0.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const { id: conversationId } = await context.params;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 },
      );
    }

    const readAt = await conversationRepository.markAsRead(conversationId, user.id);

    return NextResponse.json({
      data: {
        conversationId,
        readAt: readAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to mark conversation as read:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
