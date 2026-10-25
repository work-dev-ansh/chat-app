import { createSlice, createSelector, type PayloadAction } from "@reduxjs/toolkit";
import type { ChatMessage } from "@/contracts/message";
import type { ConversationSummary } from "@/contracts/conversation-summary";
import type { RootState } from "../index";

interface ChatState {
  conversations: ConversationSummary[];
  activeConversationId: string;
  // Normalized messages keyed by conversationId -> array of messages
  messagesByConversation: Record<string, ChatMessage[]>;
  onlineUserIds: string[];
  typingUsersByConversation: Record<string, string[]>; // conversationId -> array of userNames
  draftsByConversation: Record<string, string>; // conversationId -> draft string
  loadingConversations: boolean;
  loadingMessages: boolean;
  error: string | null;
}

export const DRAFTS_STORAGE_KEY = "simu_chat_drafts_v1";

/**
 * Safely loads persisted draft messages from browser localStorage.
 * Strictly requires a plain object where all keys and values are non-empty strings.
 * Discards malformed JSON, arrays, null, primitives, or invalid entries.
 */
export function loadInitialDrafts(storage?: Storage | null): Record<string, string> {
  const targetStorage = storage === null ? undefined : (storage ?? (typeof window !== "undefined" ? window.localStorage : undefined));
  if (!targetStorage) return {};

  try {
    const raw = targetStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const validDrafts: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === "string" && key.trim() && typeof value === "string") {
        validDrafts[key] = value;
      }
    }

    return validDrafts;
  } catch {
    // Malformed JSON or localStorage quota/security errors fail safely without crashing
    return {};
  }
}

/**
 * Safely persists active conversation drafts to browser localStorage.
 */
export function persistDraftsToStorage(drafts: Record<string, string>, storage?: Storage | null): void {
  const targetStorage = storage === null ? undefined : (storage ?? (typeof window !== "undefined" ? window.localStorage : undefined));
  if (!targetStorage) return;

  try {
    targetStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // QuotaExceededError or security restrictions are handled safely without logging sensitive text
  }
}


const initialState: ChatState = {
  conversations: [],
  activeConversationId: "",
  messagesByConversation: {},
  onlineUserIds: [],
  typingUsersByConversation: {},
  draftsByConversation: loadInitialDrafts(),
  loadingConversations: false,
  loadingMessages: false,
  error: null,
};

export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setConversations(state, action: PayloadAction<ConversationSummary[]>) {
      // Preserve client-side unreadCounts if incoming payload has 0
      state.conversations = action.payload.map((incoming) => {
        const existing = state.conversations.find((c) => c.id === incoming.id);
        const unreadCount = incoming.id === state.activeConversationId
          ? 0
          : (existing?.unreadCount ?? incoming.unreadCount ?? 0);
        return {
          ...incoming,
          unreadCount,
        };
      });

      if (!state.activeConversationId && action.payload.length > 0) {
        state.activeConversationId = action.payload[0].id;
        state.conversations[0].unreadCount = 0;
      }
    },
    setActiveConversationId(state, action: PayloadAction<string>) {
      state.activeConversationId = action.payload;
      // Mark selected conversation as read
      const conv = state.conversations.find((c) => c.id === action.payload);
      if (conv) {
        conv.unreadCount = 0;
      }
    },
    setMessagesForConversation(
      state,
      action: PayloadAction<{ conversationId: string; messages: ChatMessage[] }>,
    ) {
      state.messagesByConversation[action.payload.conversationId] = action.payload.messages;
    },
    addMessage(state, action: PayloadAction<ChatMessage>) {
      const msg = action.payload;
      const list = state.messagesByConversation[msg.conversationId] ?? [];
      // Deduplicate by database ID or clientMessageId
      const exists = list.some(
        (m) =>
          m.id === msg.id ||
          (m.clientMessageId && msg.clientMessageId && m.clientMessageId === msg.clientMessageId),
      );
      if (!exists) {
        state.messagesByConversation[msg.conversationId] = [...list, msg];
      }

      // If message is for a background conversation, increment its unread count and update lastMessage preview
      const conv = state.conversations.find((c) => c.id === msg.conversationId);
      if (conv) {
        conv.lastMessage = {
          id: msg.id,
          content: msg.content,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        };
        if (msg.conversationId !== state.activeConversationId) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        } else {
          conv.unreadCount = 0;
        }
      }
    },
    replaceOptimisticMessage(
      state,
      action: PayloadAction<{
        conversationId: string;
        tempId: string;
        realMessage: ChatMessage;
      }>,
    ) {
      const list = state.messagesByConversation[action.payload.conversationId] ?? [];
      const { tempId, realMessage } = action.payload;

      // Check if realMessage is already in the list
      const alreadyHasReal = list.some((m) => m.id === realMessage.id);

      if (alreadyHasReal) {
        // Just remove the temporary optimistic item
        state.messagesByConversation[action.payload.conversationId] = list.filter(
          (m) => m.id !== tempId && m.clientMessageId !== realMessage.clientMessageId,
        );
      } else {
        // Replace tempId or matching clientMessageId with realMessage
        state.messagesByConversation[action.payload.conversationId] = list.map((m) => {
          if (
            m.id === tempId ||
            (m.clientMessageId && realMessage.clientMessageId && m.clientMessageId === realMessage.clientMessageId)
          ) {
            return realMessage;
          }
          return m;
        });
      }
    },
    markMessageFailed(
      state,
      action: PayloadAction<{ conversationId: string; messageId: string }>,
    ) {
      const list = state.messagesByConversation[action.payload.conversationId] ?? [];
      state.messagesByConversation[action.payload.conversationId] = list.map((m) =>
        m.id === action.payload.messageId ? { ...m, status: "failed" } : m,
      );
    },
    setOnlineUsers(state, action: PayloadAction<string[]>) {
      state.onlineUserIds = action.payload;
    },
    userPresenceChanged(
      state,
      action: PayloadAction<{ userId: string; status: "online" | "offline" }>,
    ) {
      const set = new Set(state.onlineUserIds);
      if (action.payload.status === "online") {
        set.add(action.payload.userId);
      } else {
        set.delete(action.payload.userId);
      }
      state.onlineUserIds = Array.from(set);
    },
    setTypingUsers(
      state,
      action: PayloadAction<{ conversationId: string; userNames: string[] }>,
    ) {
      state.typingUsersByConversation[action.payload.conversationId] = action.payload.userNames;
    },
    // Draft persistence
    setDraft(state, action: PayloadAction<{ conversationId: string; draft: string }>) {
      const { conversationId, draft } = action.payload;
      if (!draft.trim()) {
        delete state.draftsByConversation[conversationId];
      } else {
        state.draftsByConversation[conversationId] = draft;
      }
      persistDraftsToStorage(state.draftsByConversation);
    },
    clearDraft(state, action: PayloadAction<string>) {
      delete state.draftsByConversation[action.payload];
      persistDraftsToStorage(state.draftsByConversation);
    },
    setLoadingConversations(state, action: PayloadAction<boolean>) {
      state.loadingConversations = action.payload;
    },
    setLoadingMessages(state, action: PayloadAction<boolean>) {
      state.loadingMessages = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setConversations,
  setActiveConversationId,
  setMessagesForConversation,
  addMessage,
  replaceOptimisticMessage,
  markMessageFailed,
  setOnlineUsers,
  userPresenceChanged,
  setTypingUsers,
  setDraft,
  clearDraft,
  setLoadingConversations,
  setLoadingMessages,
  setError,
} = chatSlice.actions;

export const chatReducer = chatSlice.reducer;

// ── Memoized Selectors (RTK createSelector) ───────────────────────────────────

export const selectChatState = (state: RootState) => state.chat;

export const selectConversations = (state: RootState) => state.chat.conversations;

export const selectActiveConversationId = (state: RootState) =>
  state.chat.activeConversationId;

export const selectOnlineUserIds = (state: RootState) => state.chat.onlineUserIds;

export const selectOnlineUserIdsSet = createSelector(
  [selectOnlineUserIds],
  (ids) => new Set(ids),
);

/**
 * Derived & Memoized: Dynamic Conversations enriched with live presence
 */
export const selectEnrichedConversations = createSelector(
  [selectConversations, selectOnlineUserIdsSet],
  (conversations, onlineSet) => {
    return conversations.map((conv) => {
      if (!conv.peerUserId) return conv;
      const isOnline = onlineSet.has(conv.peerUserId);
      return {
        ...conv,
        presence: (isOnline ? "online" : "offline") as "online" | "offline",
      };
    });
  },
);

/**
 * Derived & Memoized: Active conversation object
 */
export const selectActiveConversation = createSelector(
  [selectEnrichedConversations, selectActiveConversationId],
  (conversations, activeId) => {
    return conversations.find((c) => c.id === activeId) ?? null;
  },
);

/**
 * Derived & Memoized: Messages for active conversation
 */
export const selectActiveMessages = createSelector(
  [
    (state: RootState) => state.chat.messagesByConversation,
    selectActiveConversationId,
  ],
  (messagesByConv, activeId) => {
    return activeId ? messagesByConv[activeId] ?? [] : [];
  },
);

/**
 * Derived & Memoized: Typing user names for active conversation
 */
export const selectActiveTypingUsers = createSelector(
  [
    (state: RootState) => state.chat.typingUsersByConversation,
    selectActiveConversationId,
  ],
  (typingByConv, activeId) => {
    return activeId ? typingByConv[activeId] ?? [] : [];
  },
);

/**
 * Derived & Memoized: Current active conversation draft
 */
export const selectActiveDraft = createSelector(
  [
    (state: RootState) => state.chat.draftsByConversation,
    selectActiveConversationId,
  ],
  (draftsByConv, activeId) => {
    return activeId ? draftsByConv[activeId] ?? "" : "";
  },
);
