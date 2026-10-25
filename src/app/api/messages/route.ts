import { NextResponse } from "next/server";
import { messageRepository } from "@/infrastructure/message-repository";
import { requireAuth } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId query parameter is required" },
        { status: 400 },
      );
    }

    const messages = await messageRepository.findByConversationId(
      conversationId,
      user.id,
    );

    return NextResponse.json({ data: messages });
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "UnauthorizedError"
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 },
      );
    }

    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate session securely - NEVER trust senderId from request body!
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { conversationId, content, type, mediaUrl, isForwarded, forwardedFrom, clientMessageId } = body;

    const trimmedContent = typeof content === "string" ? content.trim() : "";
    if (!conversationId || (!trimmedContent && !mediaUrl)) {
      return NextResponse.json(
        { error: "conversationId and non-empty content or mediaUrl are required" },
        { status: 400 },
      );
    }

    // 2. Sender is ALWAYS the authenticated session user
    const stableClientMessageId =
      typeof clientMessageId === "string" && clientMessageId.trim()
        ? clientMessageId.trim()
        : `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const { messageService } = await import("@/services/message-service");
    const { message, isDuplicate } = await messageService.createMessage({
      conversationId,
      senderId: user.id,
      content: trimmedContent,
      type,
      mediaUrl,
      isForwarded,
      forwardedFrom,
      clientMessageId: stableClientMessageId,
    });

    // 3. Broadcast to Socket peers if newly created
    if (!isDuplicate) {
      await messageService.broadcastMessage(message);
    }

    return NextResponse.json({ data: message }, { status: isDuplicate ? 200 : 201 });
  } catch (error: any) {
    console.error("Failed to post message:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal Server Error" },
      { status: 400 },
    );
  }
}
