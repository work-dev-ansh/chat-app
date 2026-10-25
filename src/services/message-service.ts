import { prisma } from "@/infrastructure/prisma";
import type { ChatMessage, MessageType } from "@/contracts/message";
import { CHAT_CONFIG } from "@/constants/chat";

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  type?: MessageType;
  mediaUrl?: string | null;
  isForwarded?: boolean;
  forwardedFrom?: string | null;
  clientMessageId: string;
}

const kindMap: Record<MessageType, "TEXT" | "IMAGE" | "VIDEO" | "FILE"> = {
  text: "TEXT",
  image: "IMAGE",
  video: "VIDEO",
  file: "FILE",
};

interface PersistedMessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  kind: string;
  mediaUrl: string | null;
  isForwarded: boolean;
  forwardedFrom: string | null;
  createdAt: Date;
  sender?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

/**
 * Maps an internal database message record to the canonical serializable ChatMessage shape.
 */
function formatMessageRecord(record: PersistedMessageRecord): ChatMessage {
  return {
    id: record.id,
    conversationId: record.conversationId,
    senderId: record.senderId,
    senderName: record.sender?.name ?? null,
    senderAvatar: record.sender?.avatarUrl ?? null,
    content: record.text,
    type: record.kind.toLowerCase() as MessageType,
    mediaUrl: record.mediaUrl,
    isForwarded: record.isForwarded,
    forwardedFrom: record.forwardedFrom,
    status: "sent",
    createdAt: record.createdAt.toISOString(),
  };
}

/**
 * Type guard verifying if an error is a Prisma known request error with code P2002 (unique constraint).
 */
function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

/**
 * Shared message service providing unified validation, authorization,
 * idempotency, persistence, and real-time broadcast across REST and WebSocket transports.
 */
export const messageService = {
  /**
   * Persists a message with idempotency.
   * If a message with (senderId, clientMessageId) already exists, returns the existing canonical record.
   */
  async createMessage(input: CreateMessageInput): Promise<{ message: ChatMessage; isDuplicate: boolean }> {
    const trimmedContent = input.content ? input.content.trim() : "";
    if (!trimmedContent && !input.mediaUrl) {
      throw new Error("Message content or media is required");
    }

    if (trimmedContent.length > CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
      throw new Error(`Message exceeds maximum length of ${CHAT_CONFIG.MAX_MESSAGE_LENGTH} characters`);
    }

    if (!input.clientMessageId) {
      throw new Error("clientMessageId is required for delivery idempotency");
    }

    // Verify sender is an active member of the target conversation
    const membership = await prisma.membership.findUnique({
      where: {
        userId_conversationId: {
          userId: input.senderId,
          conversationId: input.conversationId,
        },
      },
    });

    if (!membership) {
      throw new Error("Unauthorized: Sender is not a member of this conversation");
    }

    // Fast-path idempotency check for retried or previously confirmed messages
    const existing = await prisma.message.findUnique({
      where: {
        senderId_clientMessageId: {
          senderId: input.senderId,
          clientMessageId: input.clientMessageId,
        },
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (existing) {
      return {
        message: formatMessageRecord(existing),
        isDuplicate: true,
      };
    }

    const kind = kindMap[input.type ?? "text"] ?? "TEXT";

    // Atomically persist message and bump conversation updatedAt
    try {
      const [record] = await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: input.conversationId,
            senderId: input.senderId,
            clientMessageId: input.clientMessageId,
            text: trimmedContent,
            kind,
            mediaUrl: input.mediaUrl ?? null,
            isForwarded: Boolean(input.isForwarded),
            forwardedFrom: input.forwardedFrom ?? null,
          },
          include: {
            sender: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        }),
        prisma.conversation.update({
          where: { id: input.conversationId },
          data: { updatedAt: new Date() },
        }),
      ]);

      return {
        message: formatMessageRecord(record),
        isDuplicate: false,
      };
    } catch (err: unknown) {
      // Handle concurrent race condition where two requests pass the fast-path check
      // simultaneously and PostgreSQL triggers unique constraint P2002 on (senderId, clientMessageId).
      if (isPrismaUniqueConstraintError(err)) {
        const found = await prisma.message.findUnique({
          where: {
            senderId_clientMessageId: {
              senderId: input.senderId,
              clientMessageId: input.clientMessageId,
            },
          },
          include: {
            sender: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        });
        if (found) {
          return {
            message: formatMessageRecord(found),
            isDuplicate: true,
          };
        }
      }
      throw err;
    }
  },

  /**
   * Broadcasts a persisted message to the Socket.IO server so connected peers
   * receive real-time updates regardless of whether the message was submitted via REST or WebSocket.
   */
  async broadcastMessage(message: ChatMessage, excludeSocketId?: string): Promise<void> {
    const socketPort = process.env.SOCKET_PORT ?? "3001";
    const socketHost = process.env.SOCKET_INTERNAL_URL ?? `http://localhost:${socketPort}`;

    const isProduction = process.env.NODE_ENV === "production";
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (isProduction && !secret && !process.env.INTERNAL_BROADCAST_SECRET) {
      throw new Error("[MessageService] Fatal: AUTH_SECRET or INTERNAL_BROADCAST_SECRET must be defined in production.");
    }

    const resolvedSecret = secret || "simuphish-development-secret-key-32chars";
    const broadcastSecret = process.env.INTERNAL_BROADCAST_SECRET ?? resolvedSecret;

    try {
      const response = await fetch(`${socketHost}/internal/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": broadcastSecret,
        },
        body: JSON.stringify({
          conversationId: message.conversationId,
          message,
          excludeSocketId,
        }),
      });

      if (!response.ok) {
        console.warn(`[MessageService] Broadcast returned status ${response.status}`);
      }
    } catch (err) {
      // Socket server might be offline or starting up; don't fail message persistence
      console.warn("[MessageService] Internal broadcast error:", err);
    }
  },
};
