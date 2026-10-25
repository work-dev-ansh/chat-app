"use client";

import type { DragEvent } from "react";
import type { ChatMessage } from "@/contracts/message";
import { formatMessageTime } from "@/utils/format";
import { Avatar, Badge, ForwardIcon } from "@anshuman/ui";
import { useAppDispatch } from "@/store/hooks";
import { setDraggedMessage, openForwardModal } from "@/store/slices/ui-slice";

interface MessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  senderName?: string;
  onMediaLoad?: () => void;
}

export default function MessageItem({
  message,
  isOwnMessage,
  senderName = isOwnMessage ? "You" : "Teammate",
  onMediaLoad,
}: MessageItemProps) {
  const dispatch = useAppDispatch();
  const formattedTime = formatMessageTime(message.createdAt);

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("application/json", JSON.stringify(message));
    e.dataTransfer.effectAllowed = "copy";
    dispatch(setDraggedMessage(message));
  }

  function handleDragEnd() {
    dispatch(setDraggedMessage(null));
  }

  return (
    <article
      className={`message-row ${isOwnMessage ? "message-own" : ""}`}
      aria-label={`Message from ${senderName}`}
    >
      {!isOwnMessage && (
        <div className="message-avatar">
          <Avatar name={senderName} size="md" />
        </div>
      )}

      <div className="message-content">
        {!isOwnMessage && (
          <span className="message-sender">{senderName}</span>
        )}

        {/* Message bubble: Draggable to forward to contacts */}
        <div
          className="message-bubble draggable-message"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {message.isForwarded && (
            <div className="forwarded-tag">
              <Badge variant="neutral">
                <ForwardIcon size={12} className="inline mr-1" /> Forwarded
              </Badge>
            </div>
          )}

          {/* Media Rendering: Images and Videos */}
          {message.mediaUrl && message.type === "image" && (
            <div className="message-media-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.mediaUrl}
                alt={message.content || "Uploaded media image"}
                className="message-image"
                loading="lazy"
                onLoad={onMediaLoad}
              />
            </div>
          )}

          {message.mediaUrl && message.type === "video" && (
            <div className="message-media-container">
              <video
                src={message.mediaUrl}
                controls
                className="message-video"
                preload="metadata"
                onLoadedData={onMediaLoad}
              />
            </div>
          )}

          <div className="message-text">{message.content}</div>
        </div>

        {/* Floating Hover Action Toolbar */}
        <div className="message-hover-toolbar" role="toolbar" aria-label="Message actions">
          <button
            type="button"
            className="hover-action-btn"
            onClick={() => dispatch(openForwardModal(message))}
            title="Forward message"
            aria-label="Forward message"
          >
            <ForwardIcon size={14} />
          </button>
          <button
            type="button"
            className="hover-action-btn"
            onClick={() => alert("Thread replies are planned for a future release.")}
            title="Reply in thread (Future Scope)"
            aria-label="Reply in thread (Future Scope)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
          </button>
          <button
            type="button"
            className="hover-action-btn"
            onClick={() => alert("Emoji reactions are planned for a future release.")}
            title="Add reaction (Future Scope)"
            aria-label="Add reaction (Future Scope)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <button
            type="button"
            className="hover-action-btn"
            onClick={() => alert("Pinning & message bookmarking are planned for a future release.")}
            title="Bookmark / Pin (Future Scope)"
            aria-label="Bookmark / Pin (Future Scope)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

        <span className="message-meta" suppressHydrationWarning>
          {formattedTime}
          {isOwnMessage && message.status === "sending" && (
            <span
              className="message-status text-xs"
              role="status"
              aria-label="Sending message"
              style={{ marginLeft: "0.375rem", fontStyle: "italic", opacity: 0.85 }}
            >
              · Sending…
            </span>
          )}
          {isOwnMessage && message.status === "failed" && (
            <span
              className="message-status text-xs"
              role="alert"
              aria-label="Failed to send message"
              style={{ marginLeft: "0.375rem", color: "#f87171", fontWeight: 600 }}
            >
              · Failed to send
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
