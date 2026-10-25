"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/contracts/message";
import MessageItem from "./MessageItem";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  peerName?: string;
}

export default function MessageList({
  messages,
  currentUserId,
  peerName,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const previousLastMessageIdRef = useRef<string | null>(null);

  // Check scroll position to determine if the user is viewing older messages
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    // A threshold of 80px accommodates small dynamic heights while keeping reading stable
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= 80;
  };

  const handleMediaLoad = () => {
    if (isNearBottomRef.current && typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Scroll to bottom unconditionally on initial mount or when switching conversations
  useEffect(() => {
    if (messages.length > 0) {
      if (typeof bottomRef.current?.scrollIntoView === "function") {
        bottomRef.current.scrollIntoView({ behavior: "auto" });
      }
      isNearBottomRef.current = true;
    }
    previousLastMessageIdRef.current = messages[messages.length - 1]?.id ?? null;
  }, [messages[0]?.conversationId]);

  // Handle incoming messages: auto-scroll only if user was already near the bottom
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?.id ?? null;

    if (
      lastMessageId &&
      lastMessageId !== previousLastMessageIdRef.current &&
      isNearBottomRef.current
    ) {
      if (typeof bottomRef.current?.scrollIntoView === "function") {
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }

    previousLastMessageIdRef.current = lastMessageId;
  }, [messages]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="message-list"
      role="log"
      aria-label="Message history"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.length === 0 ? (
        <div
          className="message-list-empty text-center text-muted"
          role="status"
          style={{
            margin: "auto",
            padding: "2rem 1rem",
            color: "var(--ui-color-muted, #9aa9bf)",
            fontSize: "0.875rem",
          }}
        >
          <p>No messages yet. Say hello to start the conversation!</p>
        </div>
      ) : (
        <>
          <div className="date-divider">
            <span>Today</span>
          </div>

          {messages.map((message) => {
            const isOwn = message.senderId === currentUserId;
            const displayName = isOwn
              ? "You"
              : message.senderName || peerName || "Teammate";
            return (
              <MessageItem
                key={message.id}
                message={message}
                isOwnMessage={isOwn}
                senderName={displayName}
                onMediaLoad={handleMediaLoad}
              />
            );
          })}
          <div ref={bottomRef} data-testid="message-list-bottom" />
        </>
      )}
    </div>
  );
}
