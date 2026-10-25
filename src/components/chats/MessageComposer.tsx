"use client";

import { useState, useRef, useEffect, type FormEvent, type DragEvent } from "react";
import { Button, Input, Spinner, PaperclipIcon, SendIcon, CloseIcon, ImageIcon, VideoIcon } from "@anshuman/ui";
import { CHAT_CONFIG } from "@/constants/chat";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setDraft,
  clearDraft,
  selectActiveDraft,
  selectActiveConversationId,
} from "@/store/slices/chat-slice";
import {
  setMediaUploading,
  selectIsUploadingMedia,
} from "@/store/slices/ui-slice";
import { chatApi } from "@/services/chat-api";
import type { MessageType } from "@/contracts/message";

interface MessageComposerProps {
  onSendMessage: (
    content: string,
    media?: { url: string; type: MessageType; name?: string },
  ) => void;
  onTyping?: (isTyping: boolean) => void;
  conversationName: string;
}

export default function MessageComposer({
  onSendMessage,
  onTyping,
  conversationName,
}: MessageComposerProps) {
  const dispatch = useAppDispatch();
  const activeConversationId = useAppSelector(selectActiveConversationId);
  const activeDraft = useAppSelector(selectActiveDraft);
  const isUploadingMedia = useAppSelector(selectIsUploadingMedia);

  const [text, setText] = useState(activeDraft);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{
    url: string;
    type: MessageType;
    name: string;
  } | null>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Sync draft and clear pending media only when the active conversation changes
  useEffect(() => {
    setText(activeDraft);
    setPendingMedia(null);
  }, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  function handleChange(value: string) {
    setText(value);
    if (activeConversationId) {
      dispatch(setDraft({ conversationId: activeConversationId, draft: value }));
    }

    if (!onTyping) return;
    if (value.trim().length > 0) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2500);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onTyping(false);
    }
  }

  async function handleFileUpload(file: File) {
    try {
      dispatch(setMediaUploading({ isUploading: true, progress: 10 }));
      const uploaded = await chatApi.media.upload(file);
      dispatch(setMediaUploading({ isUploading: true, progress: 100 }));

      setPendingMedia({
        url: uploaded.url,
        type: uploaded.type,
        name: uploaded.originalName,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload file";
      alert(message);
    } finally {
      dispatch(setMediaUploading({ isUploading: false, progress: 0 }));
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Prevent duplicate synchronous submissions from the exact same submit event / rapid clicks
    if (isSubmittingRef.current) return;

    const content = text.trim();
    if (!content && !pendingMedia) return;

    if (content.length > CHAT_CONFIG.MAX_MESSAGE_LENGTH) return;

    const currentMedia = pendingMedia;
    isSubmittingRef.current = true;

    try {
      // onSendMessage is fire-and-forget; optimistic insertion is synchronous in Redux,
      // while network transmission (Socket/REST) continues asynchronously in the background.
      onSendMessage(
        content || (currentMedia?.type === "image" ? "Sent an image" : "Sent a video"),
        currentMedia ?? undefined,
      );

      // Draft is cleared only after onSendMessage has accepted the submission
      setText("");
      setPendingMedia(null);
      if (activeConversationId) {
        dispatch(clearDraft(activeConversationId));
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (onTyping) onTyping(false);
    } catch (err) {
      // Preserve user input and draft if dispatch fails synchronously
      console.error("Message dispatch failed:", err);
    } finally {
      // Release lock on the immediate next turn so the current submit event completes,
      // without locking out legitimate successive messages typed by the user.
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 0);
    }
  }

  return (
    <div
      className={`composer-wrapper ${isDragOver ? "drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Upload Drag Overlay */}
      {isDragOver && (
        <div className="composer-drop-overlay">
          <span>Drop image or video here to attach</span>
        </div>
      )}

      {/* Uploading progress indicator with anshuman-ui Spinner */}
      {isUploadingMedia && (
        <div className="upload-progress-bar">
          <Spinner size="sm" />
          <span>Uploading media to Cloudinary...</span>
        </div>
      )}

      {/* Pending media preview bar */}
      {pendingMedia && (
        <div className="media-preview-bar">
          <span className="media-icon">
            {pendingMedia.type === "image" ? <ImageIcon size={16} /> : <VideoIcon size={16} />}
          </span>
          <span className="media-filename">{pendingMedia.name}</span>
          <button
            type="button"
            className="remove-media-btn"
            onClick={() => setPendingMedia(null)}
            aria-label="Remove media"
            title="Remove media"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      <form className="composer-form" onSubmit={handleSubmit} aria-label={`Send message to ${conversationName}`}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: "none" }}
          data-testid="composer-file-input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />

        {/* Media attach button */}
        <Button
          type="button"
          variant="ghost"
          size="md"
          className="composer-attach-btn"
          title="Upload image or video (or drag & drop)"
          aria-label="Attach media"
          onClick={() => fileInputRef.current?.click()}
        >
          <PaperclipIcon size={18} />
        </Button>

        <div className="composer-input-container">
          <Input
            id="message-input"
            aria-label={`Message ${conversationName}`}
            value={text}
            onChange={(event) => handleChange(event.target.value)}
            placeholder={`Message ${conversationName}... (Drag media or type)`}
            autoComplete="off"
            maxLength={CHAT_CONFIG.MAX_MESSAGE_LENGTH}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="composer-send-btn"
          aria-label="Send message"
          disabled={!text.trim() && !pendingMedia}
        >
          <span>Send</span>
          <SendIcon size={15} />
        </Button>
      </form>
    </div>
  );
}
