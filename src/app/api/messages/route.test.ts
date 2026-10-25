import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { requireAuth } from "@/lib/server-auth";
import { messageRepository, UnauthorizedError } from "@/infrastructure/message-repository";
import { NextResponse } from "next/server";

vi.mock("@/lib/server-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/infrastructure/message-repository", () => ({
  messageRepository: {
    findByConversationId: vi.fn(),
  },
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message: string = "Unauthorized: You do not have access to this conversation") {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));

describe("GET /api/messages route handler", () => {
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

    const request = new Request("http://localhost:3000/api/messages?conversationId=conv-1");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized: You must be signed in");
    expect(messageRepository.findByConversationId).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 when conversationId query parameter is missing", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
      },
      errorResponse: null,
    });

    const request = new Request("http://localhost:3000/api/messages");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("conversationId query parameter is required");
    expect(messageRepository.findByConversationId).not.toHaveBeenCalled();
  });

  it("returns HTTP 403 when a non-member attempts to retrieve message history", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "attacker-user-99",
        name: "Attacker",
        email: "attacker@example.com",
      },
      errorResponse: null,
    });

    vi.mocked(messageRepository.findByConversationId).mockRejectedValue(
      new UnauthorizedError("Unauthorized: You are not a member of this conversation"),
    );

    const request = new Request("http://localhost:3000/api/messages?conversationId=conv-private-1");
    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized: You are not a member of this conversation");
    expect(messageRepository.findByConversationId).toHaveBeenCalledWith("conv-private-1", "attacker-user-99");
  });

  it("returns HTTP 200 with message history for an authorized conversation member", async () => {
    const mockMessages = [
      {
        id: "msg-1",
        conversationId: "conv-team-1",
        senderId: "user-bob",
        content: "Hello team",
        type: "text" as const,
        mediaUrl: null,
        isForwarded: false,
        forwardedFrom: null,
        createdAt: "2026-01-01T12:00:00.000Z",
      },
      {
        id: "msg-2",
        conversationId: "conv-team-1",
        senderId: "user-alice",
        content: "Hey Bob",
        type: "text" as const,
        mediaUrl: null,
        isForwarded: false,
        forwardedFrom: null,
        createdAt: "2026-01-01T12:01:00.000Z",
      },
    ];

    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        id: "user-alice",
        name: "Alice",
        email: "alice@example.com",
      },
      errorResponse: null,
    });

    vi.mocked(messageRepository.findByConversationId).mockResolvedValue(mockMessages);

    const request = new Request("http://localhost:3000/api/messages?conversationId=conv-team-1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(mockMessages);
    expect(messageRepository.findByConversationId).toHaveBeenCalledWith("conv-team-1", "user-alice");
  });
});
