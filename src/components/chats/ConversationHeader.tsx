"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, Badge, Button, MoreHorizontalIcon } from "@anshuman/ui";

interface ConversationHeaderProps {
  name: string;
  isOnline: boolean;
  type?: "direct" | "group";
  memberCount?: number;
  participants?: string[];
}

export default function ConversationHeader({
  name,
  isOnline,
  type = "direct",
  memberCount,
  participants,
}: ConversationHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isGroup = type === "group";

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  let statusText = isOnline ? "End-to-end encrypted session active" : "Last seen recently";
  if (isGroup) {
    if (participants && participants.length > 0) {
      statusText = participants.join(", ");
    } else if (memberCount) {
      statusText = `${memberCount} members in channel`;
    } else {
      statusText = "Group conversation";
    }
  }

  return (
    <header className="chat-header">
      <div className="avatar-with-badge">
        <Avatar name={name} size="md" />
        {!isGroup && (
          <span
            className={`presence-indicator ${isOnline ? "online" : "offline"}`}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="chat-header-info">
        <div className="chat-header-title-row">
          <h2>{name}</h2>
          {isGroup ? (
            <Badge variant="primary">
              {memberCount ? `${memberCount} members` : "Group"}
            </Badge>
          ) : (
            <Badge variant={isOnline ? "success" : "neutral"}>
              {isOnline ? "Active" : "Offline"}
            </Badge>
          )}
        </div>
        <p className="chat-header-status-text">
          {statusText}
        </p>
      </div>

      <div className="chat-header-actions" ref={menuRef} style={{ position: "relative" }}>
        <Button
          variant="ghost"
          size="sm"
          className="header-action-btn"
          aria-label="Conversation options"
          title="Conversation options"
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <MoreHorizontalIcon size={18} />
        </Button>

        {isMenuOpen && (
          <div className="header-options-dropdown" role="menu" aria-label="Conversation options menu">
            <div className="options-dropdown-header">
              <strong>{isGroup ? "Channel Options" : "Chat Options"}</strong>
              <span className="text-xs text-muted">{isGroup ? `${memberCount || 2} members` : "Direct conversation"}</span>
            </div>

            <div className="dropdown-divider" />

            {isGroup ? (
              <button
                type="button"
                className="options-dropdown-item"
                role="menuitem"
                onClick={() => {
                  alert(`Participants in ${name}:\n${participants?.join(", ") || name}`);
                  setIsMenuOpen(false);
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>View Participants</span>
              </button>
            ) : (
              <button
                type="button"
                className="options-dropdown-item"
                role="menuitem"
                onClick={() => {
                  alert(`User Profile: ${name}\nStatus: ${isOnline ? "Online" : "Offline"}`);
                  setIsMenuOpen(false);
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>View Profile</span>
              </button>
            )}

            <button
              type="button"
              className="options-dropdown-item"
              role="menuitem"
              onClick={() => {
                alert("Muting notifications for this conversation is planned for a future release.");
                setIsMenuOpen(false);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="flex-1">Mute Notifications</span>
              <Badge variant="neutral">Future</Badge>
            </button>

            <button
              type="button"
              className="options-dropdown-item"
              role="menuitem"
              onClick={() => {
                alert("Exporting chat transcripts (JSON/PDF) is planned for a future release.");
                setIsMenuOpen(false);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="flex-1">Export Chat Transcript</span>
              <Badge variant="neutral">Future</Badge>
            </button>

            <div className="dropdown-divider" />

            <button
              type="button"
              className="options-dropdown-item danger"
              role="menuitem"
              onClick={() => {
                alert("Leaving channels or archiving conversations is planned for a future release.");
                setIsMenuOpen(false);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="flex-1">{isGroup ? "Leave Channel" : "Clear History"}</span>
              <Badge variant="neutral">Future</Badge>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
