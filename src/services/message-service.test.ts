import { describe, it, expect, vi, beforeEach } from "vitest";
import { messageService } from "./message-service";
import { prisma } from "@/infrastructure/prisma";

// Mock prisma
vi.mock("@/infrastructure/prisma", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    conversation: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("messageService authorization and idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects oversized message exceeding 2000 characters before database checks", async () => {
    const oversizedContent = "a".repeat(2001);

    await expect(
      messageService.createMessage({
        conversationId: "conv-1",
        senderId: "user-1",
        content: oversizedContent,
        clientMessageId: "cmsg-oversized-1",
      }),
    ).rejects.toThrow("Message exceeds maximum length of 2000 characters");

    // Must fail fast before querying membership or database
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    expect(prisma.message.findUnique).not.toHaveBeenCalled();
  });

  it("allows media-only message with empty content if mediaUrl is provided", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      userId: "user-1",
      conversationId: "conv-1",
      joinedAt: new Date(),
    } as any);

    vi.mocked(prisma.message.findUnique).mockResolvedValue(null);

    const mediaRecord = {
      id: "msg-media-1",
      conversationId: "conv-1",
      senderId: "user-1",
      clientMessageId: "cmsg-media-1",
      text: "",
      kind: "IMAGE" as const,
      mediaUrl: "https://res.cloudinary.com/demo/image.png",
      isForwarded: false,
      forwardedFrom: null,
      createdAt: new Date(),
    };

    vi.mocked(prisma.$transaction).mockResolvedValue([mediaRecord, {}] as any);

    const result = await messageService.createMessage({
      conversationId: "conv-1",
      senderId: "user-1",
      content: "",
      type: "image",
      mediaUrl: "https://res.cloudinary.com/demo/image.png",
      clientMessageId: "cmsg-media-1",
    });

    expect(result.message.type).toBe("image");
    expect(result.message.mediaUrl).toBe("https://res.cloudinary.com/demo/image.png");
    expect(result.isDuplicate).toBe(false);
  });

  it("rejects unauthorized message submission when user is not a member", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    await expect(
      messageService.createMessage({
        conversationId: "conv-secret",
        senderId: "attacker-user",
        content: "I should not be able to send this",
        clientMessageId: "cmsg-att-1",
      }),
    ).rejects.toThrow("Unauthorized: Sender is not a member of this conversation");

    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: {
        userId_conversationId: {
          userId: "attacker-user",
          conversationId: "conv-secret",
        },
      },
    });
  });

  it("handles duplicate retry idempotently by returning existing persisted message without re-inserting", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      userId: "user-1",
      conversationId: "conv-1",
      joinedAt: new Date(),
    } as any);

    const existingMessage = {
      id: "msg-persisted-1",
      conversationId: "conv-1",
      senderId: "user-1",
      clientMessageId: "cmsg-stable-999",
      text: "First submission attempt",
      kind: "TEXT" as const,
      mediaUrl: null,
      isForwarded: false,
      forwardedFrom: null,
      createdAt: new Date(),
    };

    vi.mocked(prisma.message.findUnique).mockResolvedValue(existingMessage as any);

    const result = await messageService.createMessage({
      conversationId: "conv-1",
      senderId: "user-1",
      content: "First submission attempt",
      clientMessageId: "cmsg-stable-999",
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.message.id).toBe("msg-persisted-1");
    expect(result.message.content).toBe("First submission attempt");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("persists new message atomically in a transaction when valid", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      userId: "user-1",
      conversationId: "conv-1",
      joinedAt: new Date(),
    } as any);

    vi.mocked(prisma.message.findUnique).mockResolvedValue(null);

    const newlyCreated = {
      id: "msg-new-123",
      conversationId: "conv-1",
      senderId: "user-1",
      clientMessageId: "cmsg-new-123",
      text: "Hello team",
      kind: "TEXT" as const,
      mediaUrl: null,
      isForwarded: false,
      forwardedFrom: null,
      createdAt: new Date(),
    };

    vi.mocked(prisma.$transaction).mockResolvedValue([newlyCreated, {}] as any);

    const result = await messageService.createMessage({
      conversationId: "conv-1",
      senderId: "user-1",
      content: "Hello team",
      clientMessageId: "cmsg-new-123",
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.message.id).toBe("msg-new-123");
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("handles race condition where Prisma throws P2002 duplicate key constraint", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      userId: "user-1",
      conversationId: "conv-1",
      joinedAt: new Date(),
    } as any);

    // Initial check is null (simulating concurrent submission)
    vi.mocked(prisma.message.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "msg-race-winner",
        conversationId: "conv-1",
        senderId: "user-1",
        clientMessageId: "cmsg-concurrent-1",
        text: "Concurrent submission",
        kind: "TEXT" as const,
        mediaUrl: null,
        isForwarded: false,
        forwardedFrom: null,
        createdAt: new Date(),
      } as any);

    const p2002Error: any = new Error("Unique constraint failed");
    p2002Error.code = "P2002";
    vi.mocked(prisma.$transaction).mockRejectedValue(p2002Error);

    const result = await messageService.createMessage({
      conversationId: "conv-1",
      senderId: "user-1",
      content: "Concurrent submission",
      clientMessageId: "cmsg-concurrent-1",
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.message.id).toBe("msg-race-winner");
  });
});
