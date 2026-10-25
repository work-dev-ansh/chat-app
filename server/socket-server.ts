import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "socket.io";
import { getToken, type JWT } from "next-auth/jwt";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../src/contracts/socket-events";
import { messageService } from "../src/services/message-service";
import { prisma } from "../src/infrastructure/prisma";

const port = Number(process.env.PORT ?? process.env.SOCKET_PORT ?? 3001);

const isProduction = process.env.NODE_ENV === "production";
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

if (isProduction && !secret) {
  throw new Error("[Socket Server] Fatal: AUTH_SECRET must be defined in production environment.");
}

const resolvedSecret = secret || "nexuschat-development-secret-32chars";
const broadcastSecret = process.env.INTERNAL_BROADCAST_SECRET ?? resolvedSecret;

function getErrorMessage(error: unknown, fallback: string = "Internal error"): string {
  return error instanceof Error ? error.message : fallback;
}

// In-memory multi-tab presence tracking: Map<userId, Set<socketId>>
const onlineUserSockets = new Map<string, Set<string>>();

function getOnlineUserIds(): string[] {
  return Array.from(onlineUserSockets.keys());
}

/**
 * HTTP server hosting Socket.IO upgrades and the loopback broadcast endpoint.
 */
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Loopback webhook invoked by Next.js REST API to synchronize socket peers
  if (req.method === "POST" && req.url === "/internal/broadcast") {
    const authHeader = req.headers["x-internal-secret"];
    if (authHeader !== broadcastSecret) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized broadcast request" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const { conversationId, message, excludeSocketId } = parsed;

        if (
          !conversationId ||
          typeof conversationId !== "string" ||
          !message ||
          typeof message !== "object" ||
          !message.id
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid broadcast payload: conversationId and valid message required" }));
          return;
        }

        if (excludeSocketId && typeof excludeSocketId === "string") {
          io.to(conversationId).except(excludeSocketId).emit("message:new", message);
        } else {
          io.to(conversationId).emit("message:new", message);
        }

        // Also broadcast to all members' personal user rooms so un-opened chats receive it
        try {
          const members = await prisma.membership.findMany({
            where: { conversationId },
            select: { userId: true },
          });
          for (const member of members) {
            if (member.userId !== message.senderId) {
              if (excludeSocketId && typeof excludeSocketId === "string") {
                io.to(`user:${member.userId}`).except(excludeSocketId).emit("message:new", message);
              } else {
                io.to(`user:${member.userId}`).emit("message:new", message);
              }
            }
          }
        } catch (memberErr) {
          console.warn("[Socket] Internal broadcast member room dispatch error:", memberErr);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: getErrorMessage(err) }));
      }
    });
    return;
  }

  // Health check endpoint
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", onlineUsers: onlineUserSockets.size }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: process.env.APP_URL ?? "http://localhost:3000",
    credentials: true,
  },
  maxHttpBufferSize: 1e6,
});

// Cryptographically verify session token from handshake auth or cookie headers
io.use(async (socket, next) => {
  try {
    const req = socket.request;
    const authPayload = socket.handshake.auth as Record<string, unknown> | undefined;
    const tokenCandidate =
      typeof authPayload?.token === "string" ? authPayload.token : undefined;

    let decodedToken: JWT | null = null;

    // Extract request headers in a shape directly accepted by @auth/core getToken:
    // { headers: Headers | Record<string, string> }
    const rawHeaders = req.headers;
    const stringHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawHeaders)) {
      if (typeof value === "string") {
        stringHeaders[key] = value;
      } else if (Array.isArray(value)) {
        stringHeaders[key] = value.join(", ");
      }
    }

    const tokenReq = { headers: stringHeaders };

    // 1. Try decoding explicit bearer token provided in auth payload
    if (tokenCandidate) {
      decodedToken = await getToken({
        req: {
          headers: {
            ...stringHeaders,
            authorization: `Bearer ${tokenCandidate}`,
          },
        },
        secret: resolvedSecret,
      });
    }

    // 2. Decode session cookie from handshake HTTP request
    if (!decodedToken) {
      decodedToken = await getToken({
        req: tokenReq,
        secret: resolvedSecret,
      });
    }

    // 3. Fallback for production HTTPS cookies (__Secure-authjs.session-token)
    if (!decodedToken) {
      decodedToken = await getToken({
        req: tokenReq,
        secret: resolvedSecret,
        cookieName: "__Secure-authjs.session-token",
      });
    }

    // 4. Fallback for NextAuth v4 legacy cookie name (__Secure-next-auth.session-token)
    if (!decodedToken) {
      decodedToken = await getToken({
        req: tokenReq,
        secret: resolvedSecret,
        cookieName: "__Secure-next-auth.session-token",
      });
    }

    const userId = typeof decodedToken?.id === "string" ? decodedToken.id : null;
    if (!userId) {
      console.warn("[Socket Auth] Handshake rejected: Unauthenticated connection attempt");
      return next(new Error("Unauthorized: Invalid or missing session credentials"));
    }

    // Verify user identity in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!user) {
      console.warn(`[Socket Auth] User ID ${userId} not found in database`);
      return next(new Error("Unauthorized: User not recognized"));
    }

    socket.data.userId = user.id;
    socket.data.userName = user.name ?? "User";
    return next();
  } catch (error) {
    console.error("[Socket Auth] Authentication error:", error);
    return next(new Error("Unauthorized: Authentication failure"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;

  // Join personal user room so the user receives messages sent to conversations
  // they belong to, even if they haven't explicitly clicked/opened the conversation yet.
  socket.join(`user:${userId}`);

  // Track user presence across multiple browser tabs
  const userSockets = onlineUserSockets.get(userId) ?? new Set<string>();
  const isFirstConnection = userSockets.size === 0;
  userSockets.add(socket.id);
  onlineUserSockets.set(userId, userSockets);

  console.log(`[Socket] User connected: ${userId} (${socket.data.userName}) [socket ${socket.id}]`);

  socket.emit("presence:sync", getOnlineUserIds());

  if (isFirstConnection) {
    socket.broadcast.emit("presence:change", { userId, status: "online" });
  }

  // Join conversation room with database membership authorization check
  socket.on("conversation:join", async ({ conversationId }, ack) => {
    try {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_conversationId: {
            userId: socket.data.userId,
            conversationId,
          },
        },
      });

      if (!membership) {
        if (ack) ack({ ok: false, error: "Not a member of this conversation" });
        return;
      }

      socket.join(conversationId);
      console.log(`[Socket] User ${socket.data.userId} joined room: ${conversationId}`);
      if (ack) ack({ ok: true, data: { conversationId } });
    } catch {
      if (ack) ack({ ok: false, error: "Failed to join conversation" });
    }
  });

  // Handle message dispatch over socket: verified by messageService independently
  socket.on("message:send", async (payload, ack) => {
    try {
      if (!payload.content?.trim() && !payload.mediaUrl) {
        if (ack) ack({ ok: false, error: "Message content cannot be empty" });
        return;
      }

      const clientMessageId =
        payload.clientMessageId?.trim() ||
        `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // messageService.createMessage performs independent membership authorization
      // before persisting or returning the message record.
      const { message, isDuplicate } = await messageService.createMessage({
        conversationId: payload.conversationId,
        senderId: socket.data.userId,
        content: payload.content?.trim() ?? "",
        type: payload.type,
        mediaUrl: payload.mediaUrl,
        isForwarded: payload.isForwarded,
        forwardedFrom: payload.forwardedFrom,
        clientMessageId,
      });

      // Avoid duplicate broadcast if the client retried an already processed message
      if (!isDuplicate) {
        // Broadcast to anyone actively inside the conversation room
        socket.to(payload.conversationId).emit("message:new", message);

        // Also broadcast to all conversation members' user rooms (excluding the sender)
        // so that users who don't have this conversation open in their view yet
        // still receive the message in real-time and have their conversation list updated!
        try {
          const members = await prisma.membership.findMany({
            where: { conversationId: payload.conversationId },
            select: { userId: true },
          });
          for (const member of members) {
            if (member.userId !== socket.data.userId) {
              socket.to(`user:${member.userId}`).emit("message:new", message);
            }
          }
        } catch (memberErr) {
          console.warn("[Socket] Failed to fetch conversation members for targeted broadcast:", memberErr);
        }
      }

      if (ack) ack({ ok: true, data: message });
    } catch (err) {
      console.error("[Socket] Failed to persist and broadcast message:", err);
      if (ack) ack({ ok: false, error: getErrorMessage(err, "Failed to send message") });
    }
  });

  // Typing indicator broadcast to active room participants
  socket.on("typing:set", async ({ conversationId, isTyping }) => {
    socket.to(conversationId).emit("typing:update", {
      conversationId,
      userId: socket.data.userId,
      userName: socket.data.userName,
      isTyping,
    });
  });

  // Disconnect handler with per-user socket count cleanup
  socket.on("disconnect", () => {
    const userSockets = onlineUserSockets.get(socket.data.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUserSockets.delete(socket.data.userId);
        io.emit("presence:change", {
          userId: socket.data.userId,
          status: "offline",
        });
      }
    }
    console.log(`[Socket] User disconnected: ${socket.data.userId} (socket ${socket.id})`);
  });
});

server.listen(port, () => {
  console.log(`🚀 Socket.IO server running on http://localhost:${port}`);
});

// Graceful process shutdown handling:
// io.close() gracefully disconnects sockets and closes the underlying HTTP server.
// Avoid calling server.close() directly after io.close() to prevent ERR_SERVER_NOT_RUNNING.
let isShuttingDown = false;
async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Socket Server] Received ${signal}. Closing active connections...`);

  const forceExitTimeout = setTimeout(() => {
    console.error("[Socket Server] Forced shutdown after timeout.");
    process.exit(1);
  }, 5000);
  forceExitTimeout.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      io.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await prisma.$disconnect();
    clearTimeout(forceExitTimeout);
    console.log("[Socket Server] Graceful shutdown completed.");
    process.exit(0);
  } catch (err) {
    console.error("[Socket Server] Error during shutdown:", err);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
