import { describe, it, expect, vi, beforeEach } from "vitest";
import { messageRepository, UnauthorizedError } from "./message-repository";
import { prisma } from "./prisma";

// Mock prisma database client
vi.mock("./prisma", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
  },
}));

describe("messageRepository.findByConversationId authorization and querying", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns message history in chronological order when requesting user is an authorized member", async () => {
    // 1. Mock valid conversation membership
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      userId: "user-alice",
      conversationId: "conv-team-1",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
    } as any);

    const now = new Date("2026-01-01T12:00:00.000Z");
    const later = new Date("2026-01-01T12:01:00.000Z");

    const mockRecords = [
      {
        id: "msg-1",
        conversationId: "conv-team-1",
        senderId: "user-bob",
        text: "Morning team!",
        kind: "TEXT" as const,
        mediaUrl: null,
        isForwarded: false,
        forwardedFrom: null,
        createdAt: now,
      },
      {
        id: "msg-2",
        conversationId: "conv-team-1",
        senderId: "user-alice",
        text: "Hey Bob!",
        kind: "TEXT" as const,
        mediaUrl: null,
        isForwarded: false,
        forwardedFrom: null,
        createdAt: later,
      },
    ];

    vi.mocked(prisma.message.findMany).mockResolvedValue(mockRecords as any);

    const result = await messageRepository.findByConversationId(
      "conv-team-1",
      "user-alice",
      50,
    );

    // Membership must be queried with compound primary key
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: {
        userId_conversationId: {
          userId: "user-alice",
          conversationId: "conv-team-1",
        },
      },
    });

    // Query must order ascending chronologically and respect limit
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { conversationId: "conv-team-1" },
      orderBy: { createdAt: "asc" },
      take: 50,
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

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "msg-1",
      conversationId: "conv-team-1",
      senderId: "user-bob",
      senderName: null,
      senderAvatar: null,
      content: "Morning team!",
      type: "text",
      mediaUrl: null,
      isForwarded: false,
      forwardedFrom: null,
      createdAt: now.toISOString(),
    });
    expect(result[1]).toEqual({
      id: "msg-2",
      conversationId: "conv-team-1",
      senderId: "user-alice",
      senderName: null,
      senderAvatar: null,
      content: "Hey Bob!",
      type: "text",
      mediaUrl: null,
      isForwarded: false,
      forwardedFrom: null,
      createdAt: later.toISOString(),
    });
  });

  it("rejects non-members with UnauthorizedError before querying message data", async () => {
    // Non-member: membership record does not exist
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    await expect(
      messageRepository.findByConversationId("conv-private", "attacker-user-99"),
    ).rejects.toThrow(UnauthorizedError);

    // Verify membership query occurred
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: {
        userId_conversationId: {
          userId: "attacker-user-99",
          conversationId: "conv-private",
        },
      },
    });

    // CRITICAL SECURITY INVARIANT: Message records must NOT be fetched if membership fails
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it("respects custom query limit parameter", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      userId: "user-1",
      conversationId: "conv-1",
      joinedAt: new Date(),
    } as any);

    vi.mocked(prisma.message.findMany).mockResolvedValue([]);

    await messageRepository.findByConversationId("conv-1", "user-1", 15);

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 15,
      }),
    );
  });
});
