import type { ChatMessage, MessageType } from "@/contracts/message";
import { prisma } from "./prisma";

export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized: You do not have access to this conversation") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Repository responsible for querying messages in PostgreSQL.
 * Enforces participant membership verification before returning message history.
 */
export const messageRepository = {
  /**
   * Fetches paginated or full message history for a conversation, ordered chronologically.
   * Strictly requires the requesting userId and verifies conversation membership.
   */
  async findByConversationId(
    conversationId: string,
    userId: string,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    // 1. Authorization guard: Verify requesting user is a member of this conversation
    const membership = await prisma.membership.findUnique({
      where: {
        userId_conversationId: {
          userId,
          conversationId,
        },
      },
    });

    if (!membership) {
      throw new UnauthorizedError("Unauthorized: You are not a member of this conversation");
    }

    // 2. Fetch messages ordered chronologically
    const records = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        text: true,
        kind: true,
        mediaUrl: true,
        isForwarded: true,
        forwardedFrom: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return records.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.sender?.name ?? null,
      senderAvatar: m.sender?.avatarUrl ?? null,
      content: m.text,
      type: m.kind.toLowerCase() as MessageType,
      mediaUrl: m.mediaUrl,
      isForwarded: m.isForwarded,
      forwardedFrom: m.forwardedFrom,
      createdAt: m.createdAt.toISOString(),
    }));
  },
};
