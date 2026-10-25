"use client";

import { useState, type DragEvent } from "react";
import { Avatar, Badge, Button, PlusIcon, ShieldCheckIcon } from "@anshuman/ui";
import type { ConversationSummary } from "@/contracts/conversation-summary";
import AuthProfileBar from "@/components/auth/AuthProfileBar";
import { useAppSelector } from "@/store/hooks";
import { selectDraggedMessage } from "@/store/slices/ui-slice";
import type { ChatMessage } from "@/contracts/message";

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  selectedConversationId: string;
  onSelectConversation: (conversationId: string) => void;
  onOpenNewChat?: () => void;
  onForwardMessage?: (message: ChatMessage, targetConversationId: string) => void;
  currentUserName?: string;
}

export default function ConversationSidebar({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onOpenNewChat,
  onForwardMessage,
}: ConversationSidebarProps) {
  const draggedMessage = useAppSelector(selectDraggedMessage);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  function handleDragOver(e: DragEvent<HTMLButtonElement>, convId: string) {
    if (!draggedMessage) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverTargetId(convId);
  }

  function handleDragLeave() {
    setDragOverTargetId(null);
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>, targetConvId: string) {
    e.preventDefault();
    setDragOverTargetId(null);

    let messageToForward = draggedMessage;
    if (!messageToForward) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) messageToForward = JSON.parse(raw);
      } catch (err) {
        console.error("Failed to parse dragged message:", err);
      }
    }

    if (messageToForward && onForwardMessage) {
      onForwardMessage(messageToForward, targetConvId);
    }
  }

  return (
    <aside className="chat-sidebar">
      <div className="chat-brand">
        <div className="brand-mark" aria-hidden="true">
          <ShieldCheckIcon size={20} />
        </div>

        <div className="brand-title-wrap">
          <div className="brand-header-row">
            <h1>NexusChat</h1>
            <Badge variant="primary">SECURE</Badge>
          </div>
          <p>Enterprise Workspace</p>
        </div>
      </div>

      <div className="sidebar-section-header">
        <span className="sidebar-section-label">CONVERSATIONS</span>
        {onOpenNewChat && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onOpenNewChat}
            title="Start new conversation"
            aria-label="Start new conversation"
            className="sidebar-new-btn"
          >
            <PlusIcon size={14} /> New
          </Button>
        )}
      </div>

      {draggedMessage && (
        <div className="drag-hint-banner">
          <span>Drop onto a contact to forward</span>
        </div>
      )}

      <div className="conversations-scroll-area">
        {conversations.length === 0 ? (
          <div
            className="conversations-empty-state"
            role="status"
            style={{
              padding: "1.5rem 1rem",
              textAlign: "center",
              color: "var(--ui-color-muted, #9aa9bf)",
              fontSize: "0.8125rem",
            }}
          >
            <span>No conversations yet</span>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === selectedConversationId;
            const isGroup = conv.type === "group";
            const isOnline = conv.presence === "online";
            const isDropTarget = dragOverTargetId === conv.id;

            // Compute snippet text: trim content, fallback to "Attachment" if message exists but text is empty
            const lastMsg = conv.lastMessage;
            let previewText = "No messages yet";
            if (lastMsg) {
              const trimmedContent = (lastMsg.content ?? "").trim();
              previewText = trimmedContent || "Attachment";
            }

            return (
              <button
                key={conv.id}
                className={`conversation-item ${isActive ? "active" : ""} ${
                  isDropTarget ? "drop-target-active" : ""
                }`}
                type="button"
                onClick={() => onSelectConversation(conv.id)}
                onDragOver={(e) => handleDragOver(e, conv.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, conv.id)}
                aria-pressed={isActive ? "true" : "false"}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${conv.title}, ${previewText}${conv.unreadCount > 0 ? `, ${conv.unreadCount} unread` : ""}`}
                title={
                  draggedMessage
                    ? `Drop here to forward message to ${conv.title}`
                    : conv.title
                }
              >
                <div className="avatar-with-badge">
                  <Avatar name={conv.title} size="md" />
                  {!isGroup && (
                    <span
                      className={`presence-indicator ${isOnline ? "online" : "offline"}`}
                      aria-label={isOnline ? "Online" : "Offline"}
                    />
                  )}
                </div>

                <div className="conversation-details">
                  <div className="conv-title-row">
                    <strong className="conv-title">{conv.title}</strong>
                    {conv.unreadCount > 0 && (
                      <Badge variant="danger">{conv.unreadCount}</Badge>
                    )}
                  </div>
                  <span className="conv-snippet">{previewText}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <AuthProfileBar />
    </aside>
  );
}
