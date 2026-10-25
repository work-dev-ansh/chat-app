"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/contracts/socket-events";
import type { ChatMessage } from "@/contracts/message";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export function useChatSocket(
  userId: string | undefined,
  activeConversationId: string,
  onMessageReceived: (message: ChatMessage) => void,
) {
  const socketRef = useRef<TypedSocket | null>(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const onMessageReceivedRef = useRef(onMessageReceived);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());

  // 1. Initialize and maintain connection
  useEffect(() => {
    if (!userId) return;

    let socket: TypedSocket | null = null;
    let isCancelled = false;

    async function initSocket() {
      let authToken: string | undefined = undefined;

      try {
        const tokenRes = await fetch("/api/socket-token");
        if (tokenRes.ok) {
          const json = await tokenRes.json();
          authToken = json.data?.token;
        }
      } catch (err) {
        console.warn("[Socket Client] Could not fetch signed auth token, falling back to cookies:", err);
      }

      if (isCancelled) return;

      socket = io(SOCKET_URL, {
        auth: { token: authToken },
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("[Socket Client] Connected to server:", socket?.id);
        setIsConnected(true);
      });

      socket.on("connect_error", (err) => {
        console.error("[Socket Client] Connection error:", err.message);
        setIsConnected(false);
      });

      socket.on("disconnect", () => {
        console.log("[Socket Client] Disconnected from server");
        setIsConnected(false);
      });

    // 2. Presence events
    socket.on("presence:sync", (ids) => {
      setOnlineUserIds(new Set(ids));
    });

    socket.on("presence:change", ({ userId: changedUserId, status }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (status === "online") {
          next.add(changedUserId);
        } else {
          next.delete(changedUserId);
        }
        return next;
      });
    });

    // 3. Incoming live message listener (uses ref to avoid re-running effect)
    socket.on("message:new", (message) => {
      onMessageReceivedRef.current(message);
    });

    // 4. Typing indicator listener (reads activeConversationIdRef)
    socket.on("typing:update", ({ conversationId, userId: typerId, userName, isTyping }) => {
      if (conversationId !== activeConversationIdRef.current) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (isTyping) {
          next.set(typerId, userName);
        } else {
          next.delete(typerId);
        }
        return next;
      });
    });
  }

    initSocket();

    return () => {
      isCancelled = true;
      if (socket) {
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [userId]);

  // 4. Join active conversation room whenever it changes
  useEffect(() => {
    if (!socketRef.current || !activeConversationId || !isConnected) return;

    socketRef.current.emit("conversation:join", {
      conversationId: activeConversationId,
    });
  }, [activeConversationId, isConnected]);

  // 5. Send message via WebSocket with bounded acknowledgement timeout
  function sendSocketMessage(options: {
    content: string;
    conversationId?: string;
    type?: "text" | "image" | "video" | "file";
    mediaUrl?: string | null;
    isForwarded?: boolean;
    forwardedFrom?: string | null;
    clientMessageId?: string;
    timeoutMs?: number;
  }): Promise<ChatMessage> {
    const targetConvId = options.conversationId || activeConversationId;
    const timeoutDuration = options.timeoutMs ?? 5000;

    return new Promise((resolve, reject) => {
      if (!socketRef.current || !isConnected) {
        return reject(new Error("Socket not connected"));
      }

      let hasSettled = false;
      const timer = setTimeout(() => {
        if (!hasSettled) {
          hasSettled = true;
          reject(new Error("Socket acknowledgement timed out"));
        }
      }, timeoutDuration);

      socketRef.current.emit(
        "message:send",
        {
          conversationId: targetConvId,
          content: options.content,
          type: options.type,
          mediaUrl: options.mediaUrl,
          isForwarded: options.isForwarded,
          forwardedFrom: options.forwardedFrom,
          clientMessageId: options.clientMessageId,
        },
        (ack) => {
          if (hasSettled) return;
          hasSettled = true;
          clearTimeout(timer);

          if (ack.ok && ack.data) {
            resolve(ack.data);
          } else {
            reject(new Error(ack.error ?? "Failed to send over socket"));
          }
        },
      );
    });
  }

  // 6. Broadcast typing state
  function setTyping(isTyping: boolean) {
    if (!socketRef.current || !isConnected || !activeConversationId) return;

    socketRef.current.emit("typing:set", {
      conversationId: activeConversationId,
      isTyping,
    });
  }

  return {
    isConnected,
    sendSocketMessage,
    setTyping,
    typingNames: Array.from(typingUsers.values()),
    onlineUserIds,
  };
}
