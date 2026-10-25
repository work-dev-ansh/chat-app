import { apiClient } from "@/lib/api-client";
import type { ConversationSummary } from "@/contracts/conversation-summary";
import type { ChatMessage } from "@/contracts/message";

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export const chatApi = {
  // ── Users Directory ──────────────────────────────────────────────
  users: {
    list: (excludeUserId: string = "user-1") =>
      apiClient.get<DirectoryUser[]>("/api/users", {
        params: { exclude: excludeUserId },
      }),
  },

  // ── Conversations ────────────────────────────────────────────────
  conversations: {
    list: (userId: string = "user-1") =>
      apiClient.get<ConversationSummary[]>("/api/conversations", {
        params: { userId },
      }),

    create: (userIds: string[], title?: string) =>
      apiClient.post<any>("/api/conversations", { userIds, title }),

    markAsRead: (conversationId: string) =>
      apiClient.post<{ conversationId: string; readAt: string }>(
        `/api/conversations/${conversationId}/read`,
        {},
      ),
  },

  // ── Messages ─────────────────────────────────────────────────────
  messages: {
    list: (conversationId: string) =>
      apiClient.get<ChatMessage[]>("/api/messages", {
        params: { conversationId },
      }),

    send: (input: {
      conversationId: string;
      senderId: string;
      content: string;
      type?: "text" | "image" | "video" | "file";
      mediaUrl?: string | null;
      isForwarded?: boolean;
      forwardedFrom?: string | null;
      clientMessageId?: string;
    }) => apiClient.post<ChatMessage>("/api/messages", input),
  },

  // ── Media Upload ──────────────────────────────────────────────────
  media: {
    upload: async (file: File): Promise<{
      url: string;
      type: "image" | "video";
      originalName: string;
      size: number;
    }> => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to upload file");
      }

      const json = await res.json();
      return json.data;
    },
  },
};
