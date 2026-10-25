import type { ChatMessage } from "./message";

/**
 * Shared Socket.IO event and acknowledgement contracts ensuring
 * type safety between the client application and the real-time server.
 */

export interface SocketAck<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ServerToClientEvents {
  /** Emitted when a new message has been persisted and broadcast to room peers */
  "message:new": (message: ChatMessage) => void;

  /** Emitted when a participant updates their typing status */
  "typing:update": (payload: {
    conversationId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
  }) => void;

  /** Emitted on connection with the full set of currently online user IDs */
  "presence:sync": (onlineUserIds: string[]) => void;

  /** Emitted when a user's presence transitions between online and offline */
  "presence:change": (payload: { userId: string; status: "online" | "offline" }) => void;
}

export interface ClientToServerEvents {
  /** Join a conversation room to receive real-time messages and typing indicators */
  "conversation:join": (
    payload: { conversationId: string },
    ack?: (result: SocketAck<{ conversationId: string }>) => void,
  ) => void;

  /** Send a message over WebSocket with delivery acknowledgement */
  "message:send": (
    payload: {
      conversationId: string;
      content: string;
      type?: "text" | "image" | "video" | "file";
      mediaUrl?: string | null;
      isForwarded?: boolean;
      forwardedFrom?: string | null;
      clientMessageId?: string;
    },
    ack?: (result: SocketAck<ChatMessage>) => void,
  ) => void;

  /** Broadcast current typing indicator state to room participants */
  "typing:set": (payload: {
    conversationId: string;
    isTyping: boolean;
  }) => void;
}

export interface SocketData {
  userId: string;
  userName: string;
}

/**
 * Reserved for inter-server communication when clustering or a server adapter is introduced.
 */
export interface InterServerEvents {}
