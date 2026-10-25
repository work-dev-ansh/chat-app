import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { requireAuth } from "@/lib/server-auth";
import { conversationRepository } from "@/infrastructure/conversation-repository";
import { NextResponse } from "next/server";

vi.mock("@/lib/server-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/infrastructure/conversation-repository", () => ({
  conversationRepository: {
    findSummariesForUser: vi.fn(),
    createConversationWithPeer: vi.fn(),
  },
}));

describe("/api/conversations route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/conversations", () => {
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
      expect(conversationRepository.findSummariesForUser).not.toHaveBeenCalled();
    });

    it("returns HTTP 200 with user conversation summaries for authenticated user", async () => {
      const mockSummaries = [
        {
          id: "conv-1",
          type: "direct" as const,
          title: "Bob Smith",
          peerUserId: "user-bob",
          unreadCount: 0,
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

      vi.mocked(conversationRepository.findSummariesForUser).mockResolvedValue(mockSummaries as any);

      const response = await GET();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual(mockSummaries);
      expect(conversationRepository.findSummariesForUser).toHaveBeenCalledWith("user-alice");
    });
  });

  describe("POST /api/conversations", () => {
    it("returns HTTP 401 when the request is unauthenticated", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: null,
        errorResponse: NextResponse.json(
          { error: "Unauthorized: You must be signed in to perform this action" },
          { status: 401 },
        ),
      });

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({ peerUserId: "user-bob" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(conversationRepository.createConversationWithPeer).not.toHaveBeenCalled();
    });

    it("returns HTTP 400 for malformed JSON request body", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: "invalid-json{",
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid JSON request body");
      expect(conversationRepository.createConversationWithPeer).not.toHaveBeenCalled();
    });

    it("returns HTTP 400 when body is not an object or neither userIds nor peerUserId is provided", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Either userIds array or peerUserId is required");
    });

    it("returns HTTP 400 when userIds is not an array", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({ userIds: "not-an-array" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("userIds must be an array of participant IDs");
    });

    it("returns HTTP 400 when participant IDs contain non-string or empty items", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({ userIds: ["user-bob", "", 123] }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("All participant IDs must be non-empty strings");
    });

    it("returns HTTP 400 when duplicate participant IDs are passed in userIds", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({ userIds: ["user-bob", "user-bob"] }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Duplicate participant IDs are not allowed");
      expect(conversationRepository.createConversationWithPeer).not.toHaveBeenCalled();
    });

    it("returns HTTP 400 when participant list resolves to fewer than two distinct members", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      // Passing only the current user in userIds
      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({ userIds: ["user-alice"] }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("A conversation requires at least two participants");
    });

    it("returns HTTP 400 when title is not a string", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({ userIds: ["user-bob"], title: 12345 }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("title must be a string");
    });

    it("normalizes empty or whitespace-only title to undefined", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      const mockCreated = {
        id: "conv-101",
        title: null,
        memberships: [{ userId: "user-alice" }, { userId: "user-bob" }],
      };

      vi.mocked(conversationRepository.createConversationWithPeer).mockResolvedValue(mockCreated as any);

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({ userIds: ["user-bob"], title: "    " }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(conversationRepository.createConversationWithPeer).toHaveBeenCalledWith(
        ["user-alice", "user-bob"],
        undefined,
      );
    });

    it("creates a direct conversation via peerUserId successfully with HTTP 201", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      const mockConversation = {
        id: "conv-direct-1",
        title: null,
        memberships: [{ userId: "user-alice" }, { userId: "user-bob" }],
      };

      vi.mocked(conversationRepository.createConversationWithPeer).mockResolvedValue(mockConversation as any);

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({ peerUserId: "user-bob" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data).toEqual(mockConversation);
      expect(conversationRepository.createConversationWithPeer).toHaveBeenCalledWith(
        ["user-alice", "user-bob"],
        undefined,
      );
    });

    it("creates a group conversation with title successfully with HTTP 201", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      const mockGroup = {
        id: "conv-group-1",
        title: "Engineering Team",
        memberships: [
          { userId: "user-alice" },
          { userId: "user-bob" },
          { userId: "user-carol" },
        ],
      };

      vi.mocked(conversationRepository.createConversationWithPeer).mockResolvedValue(mockGroup as any);

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          userIds: ["user-bob", "user-carol"],
          title: "  Engineering Team  ",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data).toEqual(mockGroup);
      expect(conversationRepository.createConversationWithPeer).toHaveBeenCalledWith(
        ["user-alice", "user-bob", "user-carol"],
        "Engineering Team",
      );
    });

    it("returns generic HTTP 500 when an unexpected database error occurs", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-alice",
          name: "Alice",
          email: "alice@example.com",
        },
        errorResponse: null,
      });

      vi.mocked(conversationRepository.createConversationWithPeer).mockRejectedValue(
        new Error("Connection to database pool lost: connection refused at 10.0.0.1"),
      );

      const request = new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        body: JSON.stringify({ peerUserId: "user-bob" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Internal Server Error");
      expect(body.error).not.toContain("connection refused");
    });
  });
});
