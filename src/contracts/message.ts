export type MessageType = "text" | "image" | "video" | "file";

export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

/**
 * Canonical serializable message entity shared across the REST API,
 * Socket.IO real-time transport, Redux store, and UI components.
 */
export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string | null;
  senderAvatar?: string | null;
  content: string;
  type: MessageType;
  mediaUrl?: string | null;
  mediaThumbnail?: string | null;
  isForwarded?: boolean;
  forwardedFrom?: string | null;
  status?: MessageStatus;
  clientMessageId?: string;
  createdAt: string;
}