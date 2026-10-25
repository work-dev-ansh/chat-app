"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Spinner,
  CloseIcon,
  PlusIcon,
  CheckIcon,
} from "@anshuman/ui";
import { chatApi, type DirectoryUser } from "@/services/chat-api";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (userIds: string | string[], title?: string) => Promise<void>;
  currentUserId?: string;
}

type ChatMode = "direct" | "group";

export default function NewChatModal({
  isOpen,
  onClose,
  onStartChat,
  currentUserId,
}: NewChatModalProps) {
  const [mode, setMode] = useState<ChatMode>("direct");
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingUserId, setStartingUserId] = useState<string | null>(null);

  // Group creation state
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [submittingGroup, setSubmittingGroup] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    let isMounted = true;
    setLoading(true);

    chatApi.users
      .list(currentUserId || "user-1")
      .then((data) => {
        if (isMounted) setUsers(data);
      })
      .catch((err) => console.error("Failed to load users:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      isMounted = false;
    };
  }, [isOpen, onClose, currentUserId]);

  // Reset modal state on close
  useEffect(() => {
    if (!isOpen) {
      setMode("direct");
      setGroupTitle("");
      setSelectedUserIds([]);
      setSubmittingGroup(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSelectDirect(user: DirectoryUser) {
    setStartingUserId(user.id);
    try {
      await onStartChat(user.id);
      onClose();
    } finally {
      setStartingUserId(null);
    }
  }

  function toggleGroupMember(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (selectedUserIds.length < 1 || submittingGroup) return;

    setSubmittingGroup(true);
    try {
      await onStartChat(selectedUserIds, groupTitle.trim() || undefined);
      onClose();
    } finally {
      setSubmittingGroup(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-chat-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <Card className="modal-card">
          <CardHeader className="modal-card-header">
            <div className="modal-header-text">
              <CardTitle id="new-chat-title">
                {mode === "direct" ? "New Direct Message" : "Create Group Chat"}
              </CardTitle>
              <CardDescription>
                {mode === "direct"
                  ? "Select a teammate to start a 1-on-1 direct conversation."
                  : "Pick multiple teammates to collaborate in a group channel."}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="modal-close-icon-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <CloseIcon size={16} />
            </Button>
          </CardHeader>

          {/* Mode Switcher Tabs */}
          <div className="modal-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "direct"}
              className={`modal-mode-tab ${mode === "direct" ? "active" : ""}`}
              onClick={() => setMode("direct")}
            >
              Direct Message
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "group"}
              className={`modal-mode-tab ${mode === "group" ? "active" : ""}`}
              onClick={() => setMode("group")}
            >
              Group Channel
              {selectedUserIds.length > 0 && (
                <span className="tab-counter-badge">{selectedUserIds.length}</span>
              )}
            </button>
          </div>

          <CardContent className="modal-card-content">
            {mode === "group" && (
              <div className="group-form-section">
                <label htmlFor="group-name-input" className="group-input-label">
                  Group Channel Name (Optional)
                </label>
                <Input
                  id="group-name-input"
                  placeholder="e.g. Frontend Engineering, Product Launch"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                />
                <span className="group-input-hint">
                  Select at least 1 or more participants below:
                </span>
              </div>
            )}

            {loading ? (
              <div className="modal-loading-state">
                <Spinner size="lg" />
                <span>Loading team directory...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="modal-empty-state">No team members found</div>
            ) : (
              <ul className="directory-list">
                {users.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <li key={user.id}>
                      {mode === "direct" ? (
                        <button
                          type="button"
                          className="directory-item"
                          disabled={startingUserId === user.id}
                          onClick={() => handleSelectDirect(user)}
                        >
                          <Avatar name={user.name} size="md" />
                          <div className="directory-info">
                            <strong>{user.name}</strong>
                            <span>{user.email}</span>
                          </div>
                          {startingUserId === user.id ? (
                            <div className="directory-spinner-wrap">
                              <Spinner size="sm" />
                            </div>
                          ) : (
                            <div className="directory-action-badge">
                              <PlusIcon size={14} />
                            </div>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`directory-item group-select-item ${isSelected ? "selected" : ""}`}
                          onClick={() => toggleGroupMember(user.id)}
                          aria-pressed={isSelected}
                        >
                          <Avatar name={user.name} size="md" />
                          <div className="directory-info">
                            <strong>{user.name}</strong>
                            <span>{user.email}</span>
                          </div>
                          <div
                            className={`checkbox-indicator ${isSelected ? "checked" : ""}`}
                          >
                            {isSelected ? <CheckIcon size={14} /> : null}
                          </div>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>

          {mode === "group" && (
            <CardFooter className="modal-card-footer">
              <Button variant="ghost" size="sm" onClick={onClose} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={selectedUserIds.length < 1 || submittingGroup}
                onClick={handleCreateGroup}
                type="button"
              >
                {submittingGroup ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" /> Creating...
                  </span>
                ) : (
                  `Create Group (${selectedUserIds.length + 1} members)`
                )}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
