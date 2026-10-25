"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { ChatMessage, MessageType } from "@/contracts/message";
import ConversationHeader from "./ConversationHeader";
import MessageList from "./MessageList";
import MessageComposer from "./MessageComposer";
import ConversationSidebar from "./ConversationSidebar";
import NewChatModal from "./NewChatModal";
import ForwardModal from "./ForwardModal";
import { chatApi } from "@/services/chat-api";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setConversations,
  setActiveConversationId,
  setMessagesForConversation,
  addMessage,
  replaceOptimisticMessage,
  markMessageFailed,
  setOnlineUsers,
  setTypingUsers,
  selectEnrichedConversations,
  selectActiveConversation,
  selectActiveMessages,
  selectActiveTypingUsers,
  selectActiveConversationId,
} from "@/store/slices/chat-slice";
import {
  setNewChatModalOpen,
  selectIsNewChatModalOpen,
} from "@/store/slices/ui-slice";

/**
 * Primary workspace container coordinating chat state with Redux Toolkit:
 * - Conversation summaries, active message streams, and memoized selectors
 * - Real-time Socket.IO presence, typing indicators, and message events
 * - Drag-and-drop message forwarding and accessible conversation management
 */
export default function ChatWorkspace() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const dispatch = useAppDispatch();

  // Redux Selectors
  const conversations = useAppSelector(selectEnrichedConversations);
  const activeConversation = useAppSelector(selectActiveConversation);
  const selectedConversationId = useAppSelector(selectActiveConversationId);
  const messages = useAppSelector(selectActiveMessages);
  const typingNames = useAppSelector(selectActiveTypingUsers);
  const isNewChatOpen = useAppSelector(selectIsNewChatModalOpen);

  const [loadingInitial, setLoadingInitial] = useState(true);

  // 1. Fetch conversations when user authenticates (guarded against stale account switches)
  const loadConversations = useCallback(async () => {
    if (!currentUserId) {
      dispatch(setConversations([]));
      setLoadingInitial(false);
      return;
    }

    try {
      setLoadingInitial(true);
      const data = await chatApi.conversations.list(currentUserId);
      dispatch(setConversations(data));
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingInitial(false);
    }
  }, [currentUserId, dispatch]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 2. Fetch messages whenever selected conversation changes
  useEffect(() => {
    if (!selectedConversationId) return;

    let isMounted = true;
    chatApi.messages
      .list(selectedConversationId)
      .then((data) => {
        if (isMounted) {
          dispatch(
            setMessagesForConversation({
              conversationId: selectedConversationId,
              messages: data,
            }),
          );
        }
      })
      .catch((err) => console.error("Failed to load messages:", err));

    return () => {
      isMounted = false;
    };
  }, [selectedConversationId, dispatch]);

  // 3. Real-time Socket connection
  const handleIncomingSocketMessage = useCallback((newMsg: ChatMessage) => {
    dispatch(addMessage(newMsg));
    loadConversations();
  }, [dispatch, loadConversations]);


  const { isConnected, sendSocketMessage, setTyping, onlineUserIds, typingNames: liveTypingNames } =
    useChatSocket(
      currentUserId,
      selectedConversationId,
      handleIncomingSocketMessage,
    );

  // Sync socket presence and typing into Redux store only when changed
  useEffect(() => {
    const newOnlineList = Array.from(onlineUserIds);
    dispatch((reduxDispatch, getState) => {
      const currentList = getState().chat.onlineUserIds;
      if (
        currentList.length !== newOnlineList.length ||
        currentList.some((id, idx) => id !== newOnlineList[idx])
      ) {
        reduxDispatch(setOnlineUsers(newOnlineList));
      }
    });
  }, [onlineUserIds, dispatch]);

  useEffect(() => {
    if (selectedConversationId) {
      dispatch((reduxDispatch, getState) => {
        const currentTyping =
          getState().chat.typingUsersByConversation[selectedConversationId] ?? [];
        if (
          currentTyping.length !== liveTypingNames.length ||
          currentTyping.some((name, idx) => name !== liveTypingNames[idx])
        ) {
          reduxDispatch(
            setTypingUsers({
              conversationId: selectedConversationId,
              userNames: liveTypingNames,
            }),
          );
        }
      });
    }
  }, [liveTypingNames, selectedConversationId, dispatch]);

  // 4. Send standard message or media
  async function handleSendMessage(
    content: string,
    media?: { url: string; type: MessageType; name?: string },
  ) {
    if (!selectedConversationId || !currentUserId) return;

    const clientMessageId = `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tempId = `temp-${clientMessageId}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: selectedConversationId,
      senderId: currentUserId,
      content,
      type: media?.type ?? "text",
      mediaUrl: media?.url ?? null,
      status: "sending",
      clientMessageId,
      createdAt: new Date().toISOString(),
    };

    dispatch(addMessage(optimisticMsg));

    try {
      if (isConnected) {
        const created = await sendSocketMessage({
          conversationId: selectedConversationId,
          content,
          type: media?.type ?? "text",
          mediaUrl: media?.url ?? null,
          clientMessageId,
        });
        dispatch(
          replaceOptimisticMessage({
            conversationId: selectedConversationId,
            tempId,
            realMessage: { ...created, status: "sent", clientMessageId },
          }),
        );
      } else {
        const created = await chatApi.messages.send({
          conversationId: selectedConversationId,
          senderId: currentUserId,
          content,
          type: media?.type ?? "text",
          mediaUrl: media?.url ?? null,
          clientMessageId,
        });
        dispatch(
          replaceOptimisticMessage({
            conversationId: selectedConversationId,
            tempId,
            realMessage: { ...created, status: "sent", clientMessageId },
          }),
        );
      }
      loadConversations();
    } catch (err) {
      console.error("Failed to send message:", err);
      dispatch(
        markMessageFailed({
          conversationId: selectedConversationId,
          messageId: tempId,
        }),
      );
    }
  }

  // 5. Drag-and-Forward / Modal Forward handler
  async function handleForwardMessage(
    messageToForward: ChatMessage,
    targetConversationId: string,
  ) {
    if (!currentUserId || !targetConversationId) return;

    const forwardContent = messageToForward.content || "Forwarded media";
    const clientMessageId = `cmsg-fwd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tempId = `temp-${clientMessageId}`;

    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: targetConversationId,
      senderId: currentUserId,
      content: forwardContent,
      type: messageToForward.type,
      mediaUrl: messageToForward.mediaUrl,
      isForwarded: true,
      forwardedFrom: messageToForward.senderId,
      status: "sending",
      clientMessageId,
      createdAt: new Date().toISOString(),
    };

    dispatch(addMessage(optimisticMsg));

    try {
      if (isConnected) {
        const created = await sendSocketMessage({
          conversationId: targetConversationId,
          content: forwardContent,
          type: messageToForward.type,
          mediaUrl: messageToForward.mediaUrl,
          isForwarded: true,
          forwardedFrom: messageToForward.senderId,
          clientMessageId,
        });
        dispatch(
          replaceOptimisticMessage({
            conversationId: targetConversationId,
            tempId,
            realMessage: { ...created, status: "sent", clientMessageId },
          }),
        );
      } else {
        const created = await chatApi.messages.send({
          conversationId: targetConversationId,
          senderId: currentUserId,
          content: forwardContent,
          type: messageToForward.type,
          mediaUrl: messageToForward.mediaUrl,
          isForwarded: true,
          forwardedFrom: messageToForward.senderId,
          clientMessageId,
        });
        dispatch(
          replaceOptimisticMessage({
            conversationId: targetConversationId,
            tempId,
            realMessage: { ...created, status: "sent", clientMessageId },
          }),
        );
      }
      // Switch view to target conversation to show the forwarded message
      dispatch(setActiveConversationId(targetConversationId));
      loadConversations();
    } catch (err) {
      console.error("Failed to forward message:", err);
      dispatch(
        markMessageFailed({
          conversationId: targetConversationId,
          messageId: tempId,
        }),
      );
    }
  }

  // 6. Start new conversation
  async function handleStartChat(peerUserIds: string | string[], title?: string) {
    if (!currentUserId) return;
    try {
      const userIds = Array.isArray(peerUserIds) ? peerUserIds : [peerUserIds];
      const allUserIds = Array.from(new Set([currentUserId, ...userIds]));
      const conversation = await chatApi.conversations.create(
        allUserIds,
        title,
      );
      await loadConversations();
      dispatch(setActiveConversationId(conversation.id));
      dispatch(setNewChatModalOpen(false));
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }

  const activeIsOnline = activeConversation?.presence === "online";

  return (
    <main className="chat-workspace">
      <ConversationSidebar
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={(id) => dispatch(setActiveConversationId(id))}
        onOpenNewChat={() => dispatch(setNewChatModalOpen(true))}
        onForwardMessage={handleForwardMessage}
        currentUserName={session?.user?.name ?? undefined}
      />

      <section
        className="chat-panel"
        aria-label={`Conversation with ${activeConversation?.title ?? "Chat"}`}
      >
        {activeConversation ? (
          <>
            <ConversationHeader
              name={activeConversation.title}
              isOnline={activeIsOnline}
              type={activeConversation.type}
              memberCount={activeConversation.memberCount}
              participants={activeConversation.participantNames}
            />

            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              peerName={activeConversation.title}
            />

            {typingNames.length > 0 && (
              <div className="typing-indicator-bar" role="status" aria-live="polite">
                <span className="typing-dots">
                  <span />
                  <span />
                  <span />
                </span>
                <span>{typingNames.join(", ")} is typing...</span>
              </div>
            )}

            <MessageComposer
              conversationName={activeConversation.title}
              onSendMessage={handleSendMessage}
              onTyping={setTyping}
            />
          </>
        ) : (
          <div className="empty-workspace">
            {loadingInitial ? (
              <p>Loading conversations...</p>
            ) : !currentUserId ? (
              <div className="empty-state-content">
                <h3>Sign in to start chatting</h3>
                <p>
                  Choose an account or sign in with Google in the bottom-left sidebar to view and send messages.
                </p>
              </div>
            ) : (
              <div className="empty-state-content">
                <h3>No conversations yet</h3>
                <p>
                  Click the <strong>+</strong> button in the sidebar to start a chat with anyone on the team.
                </p>
                <button
                  className="primary-btn"
                  onClick={() => dispatch(setNewChatModalOpen(true))}
                >
                  Start a conversation
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => dispatch(setNewChatModalOpen(false))}
        onStartChat={handleStartChat}
        currentUserId={currentUserId}
      />

      <ForwardModal
        onForward={handleForwardMessage}
        currentUserId={currentUserId}
      />
    </main>
  );
}
