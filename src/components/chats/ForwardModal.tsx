"use client";

import { useEffect, useState } from "react";
import { Avatar, Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CheckIcon, CloseIcon, ForwardIcon, Spinner } from "@anshuman/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  closeForwardModal,
  selectForwardState,
} from "@/store/slices/ui-slice";
import { selectConversations } from "@/store/slices/chat-slice";
import type { ChatMessage } from "@/contracts/message";
import { chatApi, type DirectoryUser } from "@/services/chat-api";

interface ForwardModalProps {
  onForward: (message: ChatMessage, targetConversationId: string) => Promise<void> | void;
  currentUserId?: string;
}

export default function ForwardModal({ onForward, currentUserId }: ForwardModalProps) {
  const dispatch = useAppDispatch();
  const { isOpen, message } = useAppSelector(selectForwardState);
  const conversations = useAppSelector(selectConversations);

  const [activeTab, setActiveTab] = useState<"conversations" | "directory">("conversations");
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedConvId("");
      setSelectedUserId("");
      setActiveTab("conversations");
      setSubmitting(false);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch(closeForwardModal());
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    if (activeTab === "directory" && directoryUsers.length === 0) {
      setLoadingUsers(true);
      chatApi.users
        .list(currentUserId || "user-1")
        .then((users) => setDirectoryUsers(users))
        .catch((err) => console.error("Failed to load directory for forwarding:", err))
        .finally(() => setLoadingUsers(false));
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, activeTab, currentUserId, directoryUsers.length, dispatch]);

  if (!isOpen || !message) return null;

  async function handleConfirm() {
    if (!message || submitting) return;

    setSubmitting(true);
    try {
      if (activeTab === "conversations") {
        if (!selectedConvId) return;
        await onForward(message, selectedConvId);
        dispatch(closeForwardModal());
      } else {
        if (!selectedUserId || !currentUserId) return;
        // Check if there is already an existing 1-on-1 direct conversation with this user
        const existingDirect = conversations.find(
          (c) => c.type === "direct" && c.peerUserId === selectedUserId,
        );

        let targetId = existingDirect?.id;
        if (!targetId) {
          const newConv = await chatApi.conversations.create([currentUserId, selectedUserId]);
          targetId = newConv.id;
        }

        if (targetId) {
          await onForward(message, targetId);
          dispatch(closeForwardModal());
        }
      }
    } catch (err) {
      console.error("Failed to forward message:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forward-dialog-title"
      onClick={() => dispatch(closeForwardModal())}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="modal-card">
          <CardHeader className="modal-card-header">
            <div>
              <CardTitle id="forward-dialog-title">Forward Message</CardTitle>
              <CardDescription>Select a team conversation to forward to</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="modal-close-icon-btn"
              onClick={() => dispatch(closeForwardModal())}
              aria-label="Close forward dialog"
            >
              <CloseIcon size={16} />
            </Button>
          </CardHeader>

          {/* Mode Switcher Tabs */}
          <div className="modal-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "conversations"}
              className={`modal-mode-tab ${activeTab === "conversations" ? "active" : ""}`}
              onClick={() => setActiveTab("conversations")}
            >
              Recent Chats ({conversations.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "directory"}
              className={`modal-mode-tab ${activeTab === "directory" ? "active" : ""}`}
              onClick={() => setActiveTab("directory")}
            >
              All Team Members
            </button>
          </div>

          {/* Message preview snippet */}
          <div className="forward-preview-box">
            <span className="forward-preview-label">Message Preview:</span>
            <p className="forward-preview-text">
              {message.content || (message.type === "image" ? "[Image]" : "[Video]")}
            </p>
          </div>

          <CardContent className="modal-card-content">
            {activeTab === "conversations" ? (
              <div className="user-selection-list" role="radiogroup" aria-label="Target chats">
                {conversations.length === 0 ? (
                  <div className="modal-empty-state">No conversations yet</div>
                ) : (
                  conversations.map((conv) => {
                    const isSelected = selectedConvId === conv.id;
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`user-select-item ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedConvId(conv.id)}
                      >
                        <Avatar name={conv.title} size="md" />
                        <div className="user-select-info">
                          <strong>{conv.title}</strong>
                          <Badge variant={conv.type === "group" ? "primary" : "neutral"}>
                            {conv.type === "group" ? "Channel" : "Direct"}
                          </Badge>
                        </div>
                        {isSelected && (
                          <span className="check-mark-badge">
                            <CheckIcon size={16} />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="user-selection-list" role="radiogroup" aria-label="Target team members">
                {loadingUsers ? (
                  <div className="modal-loading-state">
                    <Spinner size="sm" />
                    <span>Loading directory...</span>
                  </div>
                ) : directoryUsers.length === 0 ? (
                  <div className="modal-empty-state">No other team members found</div>
                ) : (
                  directoryUsers.map((user) => {
                    const isSelected = selectedUserId === user.id;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`user-select-item ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <Avatar name={user.name} size="md" />
                        <div className="user-select-info">
                          <strong>{user.name}</strong>
                          <span className="text-xs text-muted">{user.email}</span>
                        </div>
                        {isSelected && (
                          <span className="check-mark-badge">
                            <CheckIcon size={16} />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="modal-card-footer">
            <Button
              variant="secondary"
              size="md"
              onClick={() => dispatch(closeForwardModal())}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={
                submitting ||
                (activeTab === "conversations" ? !selectedConvId : !selectedUserId)
              }
              onClick={handleConfirm}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="sm" /> Forwarding...
                </span>
              ) : (
                <>
                  <ForwardIcon size={14} />
                  <span>Forward Message</span>
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
