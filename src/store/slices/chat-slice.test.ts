import { describe, it, expect } from "vitest";
import {
  chatReducer,
  addMessage,
  mergeMessagesForConversation,
  replaceOptimisticMessage,
  markMessageFailed,
  setDraft,
  clearDraft,
  selectEnrichedConversations,
  selectActiveMessages,
  selectActiveDraft,
  loadInitialDrafts,
  persistDraftsToStorage,
  DRAFTS_STORAGE_KEY,
} from "./chat-slice";
import type { RootState } from "../index";

describe("Redux chat-slice & memoized selectors", () => {
  const initialBaseState: RootState = {
    chat: {
      conversations: [
        {
          id: "conv-1",
          type: "direct",
          title: "Sarah Chen",
          peerUserId: "user-2",
          presence: "offline",
          unreadCount: 0,
        },
        {
          id: "conv-2",
          type: "direct",
          title: "James Wilson",
          peerUserId: "user-3",
          presence: "offline",
          unreadCount: 0,
        },
      ],
      activeConversationId: "conv-1",
      messagesByConversation: {
        "conv-1": [
          {
            id: "msg-1",
            conversationId: "conv-1",
            senderId: "user-2",
            content: "Hello there!",
            type: "text",
            createdAt: new Date().toISOString(),
          },
        ],
      },
      onlineUserIds: ["user-2"],
      typingUsersByConversation: {},
      draftsByConversation: {
        "conv-1": "Draft message to Sarah",
      },
      loadingConversations: false,
      loadingMessages: false,
      error: null,
    },
    ui: {
      isNewChatModalOpen: false,
      isForwardModalOpen: false,
      messageToForward: null,
      draggedMessage: null,
      isUploadingMedia: false,
      uploadProgress: 0,
    },
  };

  it("selectEnrichedConversations derives dynamic online presence accurately", () => {
    const enriched = selectEnrichedConversations(initialBaseState);
    expect(enriched[0].presence).toBe("online"); // user-2 is online
    expect(enriched[1].presence).toBe("offline"); // user-3 is offline
  });

  it("selectActiveMessages returns messages for the currently active conversation", () => {
    const messages = selectActiveMessages(initialBaseState);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hello there!");
  });

  it("selectActiveDraft returns the unsent draft for active conversation", () => {
    const draft = selectActiveDraft(initialBaseState);
    expect(draft).toBe("Draft message to Sarah");
  });

  it("addMessage reducer adds and deduplicates messages", () => {
    const state = chatReducer(
      initialBaseState.chat,
      addMessage({
        id: "msg-2",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "Second message",
        type: "text",
        createdAt: new Date().toISOString(),
      }),
    );

    expect(state.messagesByConversation["conv-1"]).toHaveLength(2);

    // Duplicate message ID should not duplicate in store
    const duplicateState = chatReducer(
      state,
      addMessage({
        id: "msg-2",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "Second message duplicate",
        type: "text",
        createdAt: new Date().toISOString(),
      }),
    );
    expect(duplicateState.messagesByConversation["conv-1"]).toHaveLength(2);
  });

  it("setDraft and clearDraft updates scoped conversation drafts", () => {
    const stateWithDraft = chatReducer(
      initialBaseState.chat,
      setDraft({ conversationId: "conv-2", draft: "New draft for James" }),
    );
    expect(stateWithDraft.draftsByConversation["conv-2"]).toBe("New draft for James");

    const stateCleared = chatReducer(stateWithDraft, clearDraft("conv-2"));
    expect(stateCleared.draftsByConversation["conv-2"]).toBeUndefined();
  });

  it("addMessage deduplicates by clientMessageId when temporary optimistic ID differs", () => {
    const state = chatReducer(
      initialBaseState.chat,
      addMessage({
        id: "temp-cmsg-123",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "Optimistic message",
        type: "text",
        clientMessageId: "cmsg-123",
        status: "sending",
        createdAt: new Date().toISOString(),
      }),
    );

    expect(state.messagesByConversation["conv-1"]).toHaveLength(2);

    // Incoming duplicate via socket broadcast with same clientMessageId but different id
    const stateWithIncoming = chatReducer(
      state,
      addMessage({
        id: "real-server-id-456",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "Optimistic message",
        type: "text",
        clientMessageId: "cmsg-123",
        status: "sent",
        createdAt: new Date().toISOString(),
      }),
    );

    // Should NOT duplicate the message
    expect(stateWithIncoming.messagesByConversation["conv-1"]).toHaveLength(2);
  });

  it("mergeMessagesForConversation preserves in-flight sending messages while deduplicating persisted items", () => {
    const stateWithOptimistic = chatReducer(
      initialBaseState.chat,
      addMessage({
        id: "temp-cmsg-in-flight",
        conversationId: "conv-1",
        senderId: "user-me",
        content: "Still waiting for persistence ack",
        type: "text",
        clientMessageId: "cmsg-in-flight",
        status: "sending",
        createdAt: new Date().toISOString(),
      }),
    );

    expect(stateWithOptimistic.messagesByConversation["conv-1"]).toHaveLength(2);

    // Merge incoming messages from polling
    const mergedState = chatReducer(
      stateWithOptimistic,
      mergeMessagesForConversation({
        conversationId: "conv-1",
        messages: [
          {
            id: "msg-1",
            conversationId: "conv-1",
            senderId: "user-2",
            content: "Hello there!",
            type: "text",
            status: "sent",
            createdAt: "2026-10-24T10:00:00Z",
          },
          {
            id: "msg-persisted-from-other",
            conversationId: "conv-1",
            senderId: "user-2",
            content: "New incoming message from Bob",
            type: "text",
            status: "sent",
            createdAt: "2026-10-24T10:05:00Z",
          },
        ],
      }),
    );

    const messages = mergedState.messagesByConversation["conv-1"];
    // Should have msg-1, msg-persisted-from-other, AND the preserved in-flight optimistic message
    expect(messages).toHaveLength(3);
    expect(messages.some((m) => m.id === "temp-cmsg-in-flight" && m.status === "sending")).toBe(true);
    expect(messages.some((m) => m.id === "msg-persisted-from-other")).toBe(true);
  });

  it("replaceOptimisticMessage cleanly reconciles pending optimistic message to confirmed server message", () => {
    const stateWithOptimistic = chatReducer(
      initialBaseState.chat,
      addMessage({
        id: "temp-cmsg-789",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "Hello server!",
        type: "text",
        clientMessageId: "cmsg-789",
        status: "sending",
        createdAt: new Date().toISOString(),
      }),
    );

    expect(stateWithOptimistic.messagesByConversation["conv-1"]).toHaveLength(2);
    expect(stateWithOptimistic.messagesByConversation["conv-1"][1].status).toBe("sending");

    // Reconcile when server confirms
    const stateReconciled = chatReducer(
      stateWithOptimistic,
      replaceOptimisticMessage({
        conversationId: "conv-1",
        tempId: "temp-cmsg-789",
        realMessage: {
          id: "db-msg-789",
          conversationId: "conv-1",
          senderId: "user-1",
          content: "Hello server!",
          type: "text",
          clientMessageId: "cmsg-789",
          status: "sent",
          createdAt: new Date().toISOString(),
        },
      }),
    );

    const list = stateReconciled.messagesByConversation["conv-1"];
    expect(list).toHaveLength(2);
    expect(list[1].id).toBe("db-msg-789");
    expect(list[1].status).toBe("sent");
  });

  it("markMessageFailed transitions sending message to failed status without dropping it", () => {
    const stateWithOptimistic = chatReducer(
      initialBaseState.chat,
      addMessage({
        id: "temp-cmsg-fail",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "Will fail",
        type: "text",
        clientMessageId: "cmsg-fail",
        status: "sending",
        createdAt: new Date().toISOString(),
      }),
    );

    const stateFailed = chatReducer(
      stateWithOptimistic,
      markMessageFailed({
        conversationId: "conv-1",
        messageId: "temp-cmsg-fail",
      }),
    );

    const list = stateFailed.messagesByConversation["conv-1"];
    expect(list).toHaveLength(2);
    expect(list[1].status).toBe("failed");
  });

  describe("Draft persistence resilience (loadInitialDrafts & persistDraftsToStorage)", () => {
    function createMockStorage(initialData: Record<string, string> = {}): Storage {
      const store: Record<string, string> = { ...initialData };
      return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          for (const k of Object.keys(store)) delete store[k];
        },
        key: (index: number) => Object.keys(store)[index] ?? null,
        length: Object.keys(store).length,
      };
    }

    it("loads valid stored drafts correctly", () => {
      const storage = createMockStorage({
        [DRAFTS_STORAGE_KEY]: JSON.stringify({
          "conv-1": "Draft message for Alice",
          "conv-2": "Draft message for Bob",
        }),
      });

      const drafts = loadInitialDrafts(storage);
      expect(drafts).toEqual({
        "conv-1": "Draft message for Alice",
        "conv-2": "Draft message for Bob",
      });
    });

    it("returns empty object when storage contains malformed JSON", () => {
      const storage = createMockStorage({
        [DRAFTS_STORAGE_KEY]: "invalid-json{",
      });

      const drafts = loadInitialDrafts(storage);
      expect(drafts).toEqual({});
    });

    it("returns empty object when storage contains JSON primitives (string, number, boolean)", () => {
      const stringStorage = createMockStorage({ [DRAFTS_STORAGE_KEY]: JSON.stringify("plain string") });
      expect(loadInitialDrafts(stringStorage)).toEqual({});

      const numberStorage = createMockStorage({ [DRAFTS_STORAGE_KEY]: JSON.stringify(12345) });
      expect(loadInitialDrafts(numberStorage)).toEqual({});

      const boolStorage = createMockStorage({ [DRAFTS_STORAGE_KEY]: JSON.stringify(true) });
      expect(loadInitialDrafts(boolStorage)).toEqual({});
    });

    it("returns empty object when storage contains JSON null or array", () => {
      const nullStorage = createMockStorage({ [DRAFTS_STORAGE_KEY]: JSON.stringify(null) });
      expect(loadInitialDrafts(nullStorage)).toEqual({});

      const arrayStorage = createMockStorage({
        [DRAFTS_STORAGE_KEY]: JSON.stringify(["draft-1", "draft-2"]),
      });
      expect(loadInitialDrafts(arrayStorage)).toEqual({});
    });

    it("filters out invalid entries and retains only string-valued entries with non-empty keys", () => {
      const storage = createMockStorage({
        [DRAFTS_STORAGE_KEY]: JSON.stringify({
          "conv-valid": "Valid message",
          "conv-num": 123,
          "conv-obj": { text: "nested" },
          "conv-arr": ["item"],
          "conv-null": null,
          "   ": "Whitespace key should be ignored",
        }),
      });

      const drafts = loadInitialDrafts(storage);
      expect(drafts).toEqual({
        "conv-valid": "Valid message",
      });
    });

    it("handles storage access exceptions safely without throwing", () => {
      const throwingStorage = {
        getItem: () => {
          throw new Error("SecurityError: Access to localStorage is denied");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } as Storage;

      expect(() => loadInitialDrafts(throwingStorage)).not.toThrow();
      expect(loadInitialDrafts(throwingStorage)).toEqual({});

      expect(() => persistDraftsToStorage({ "conv-1": "test" }, throwingStorage)).not.toThrow();
    });

    it("returns empty object when storage is unavailable (e.g. server environment or null)", () => {
      expect(loadInitialDrafts(null)).toEqual({});
      expect(() => persistDraftsToStorage({ "conv-1": "test" }, null)).not.toThrow();
    });
  });
});

