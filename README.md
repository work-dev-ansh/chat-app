# Enterprise Real-Time Chat Platform

A production-grade, real-time collaboration application built with **Next.js 16 (App Router)**, **Redux Toolkit**, **Socket.IO**, and **PostgreSQL (Prisma ORM)**. Engineered with strict focus on zero-trust security, bi-directional message synchronization, idempotency, and WCAG accessibility standards.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | Hybrid Server Components (RSC) for zero-bundle initial session resolution; focused Client Component islands for high-frequency interactive chat. |
| **State Management** | Redux Toolkit (RTK) | Normalized state (`byId` / `byConversation`), memoized derived state using `createSelector` (Reselect), and local storage draft persistence. |
| **Real-Time Transport** | Socket.IO (v4) | Bidirectional WebSocket transport with presence tracking, typing indicators, room joins, and optimistic message delivery. |
| **Database & ORM** | PostgreSQL + Prisma ORM | Relational integrity for Users, Accounts, Sessions, Conversations, Memberships, and Messages with compound unique constraints. |
| **Authentication** | NextAuth.js v5 (Auth.js) | Dual strategy: Google OAuth 2.0 + Instant Multi-User Profile Switcher; zero-trust server barrier validating session cookies. |
| **Media Pipeline** | Cloudinary Pipeline | Server-side upload route (`/api/upload`) with strict MIME validation (images/videos) and size caps. |
| **Testing** | Vitest + React Testing Library | Fast unit tests on pure/memoized selectors and behavioral component testing with `@testing-library/jest-dom`. |

---

## 📐 Server vs. Client Component Split

```mermaid
flowchart TD
    subgraph Server Boundary [Server Components - Zero Client JS]
        Layout["app/layout.tsx<br/>(Resolves Session via auth(), mounts Fonts & Theme)"]
        Page["app/page.tsx<br/>(Server Metadata & Initial Context)"]
        UploadRoute["app/api/upload/route.ts<br/>(Server-side MIME check & Cloudinary upload)"]
        MsgRoute["app/api/messages/route.ts<br/>(Session security barrier & PostgreSQL persistence)"]
    end

    subgraph Client Boundary [Client Islands - 'use client']
        Workspace["ChatWorkspace.tsx<br/>(Redux connection, Socket lifecycle)"]
        Sidebar["ConversationSidebar.tsx<br/>(Contacts, Presence dots, Drop-to-forward target)"]
        Composer["MessageComposer.tsx<br/>(Draft persistence, Drag-and-drop media, Debounced typing)"]
        MsgList["MessageList.tsx & MessageItem.tsx<br/>(Draggable bubbles, Media rendering, Keyboard action)"]
        ForwardModal["ForwardModal.tsx<br/>(WCAG 2.1 AA keyboard-accessible forward menu)"]
        NewChatModal["NewChatModal.tsx<br/>(Directory browser & multi-member group creator)"]
    end

    Layout --> Page
    Page --> Workspace
    Workspace --> Sidebar
    Workspace --> MsgList
    Workspace --> Composer
    Workspace --> ForwardModal
    Workspace --> NewChatModal
```

### Architectural Decisions
1. **Server Layout (`layout.tsx`)**: Resolves the session server-side before hydration, avoiding client cumulative layout shifts (CLS) and flashing unauthenticated states.
2. **Client Islands (`ChatWorkspace`, `MessageComposer`, `MessageList`)**: Real-time WebSockets and drag-and-drop APIs require browser event listeners (`window`, `dataTransfer`, `WebSocket`). Wrapping them as isolated client components prevents shipping unnecessary JavaScript to non-interactive sections.

---

## ⚡ Memoized Derived State with `createSelector`

All derived chat state is computed with RTK's memoized selectors (`src/store/slices/chat-slice.ts`) rather than re-evaluating inline during renders:

- `selectEnrichedConversations`: Combines conversations with the live `onlineUserIds` Set. Only recalculates when the conversation list or online user IDs change.
- `selectActiveConversation`: Memoizes the active conversation lookup by ID.
- `selectActiveMessages`: Retrieves messages for the active room with zero recalculation cost on unrelated re-renders.
- `selectActiveDraft`: Pulls the unsent input draft scoped to the active conversation.

---

## 🛡️ Reliability, Security & Edge Case Handling

### 1. Dual Transport with Unified Application Logic
- **Architecture**: `Socket.IO` and `Next.js REST API` act strictly as transport layers; neither contains independent chat domain logic.
- **Shared Message Service** (`src/services/message-service.ts`): All authorization, membership checks, persistence, duplicate handling, and cross-transport event publishing live in a single service layer.
- **REST-to-Socket Delivery**: Messages submitted via the REST fallback trigger an authenticated internal broadcast (`POST /internal/broadcast`) on the Socket.IO server, ensuring connected peers receive live updates immediately without waiting for HTTP polling.

### 2. Cryptographic Socket Handshake Authentication
- **Zero-Trust Identity**: The socket server rejects raw client-provided identities and fallback user IDs.
- **Handshake Verification**: Connections verify the NextAuth session token via Auth.js JWT decryption (`getToken`) on the handshake cookie using the server's cryptographic `AUTH_SECRET`. Unauthenticated connections are rejected with 401 handshake errors.

### 3. Idempotency & Optimistic UI Reconciliation
- **Logical Client ID**: The client assigns a stable `clientMessageId` for each send attempt.
- **Atomic Database Constraints**: Enforced by composite unique constraint `@@unique([senderId, clientMessageId])`.
- **Duplicate & Retry Protection**: If network latency triggers retries, database duplicate errors (`P2002`) are caught and return the existing persisted message cleanly.
- **Redux Reconciliation**: Messages transition seamlessly from `"sending"` to `"sent"` or `"failed"` without UI jumps or duplicated entries.

### 4. Accessibility Fallback (WCAG 2.1 AA)
- HTML5 drag-and-drop is supported for dragging messages onto sidebar contacts to forward.
- Because native drag-and-drop is not accessible via screen readers or keyboards, every message bubble also includes an accessible **Forward** button opening a keyboard-navigable modal dialog (`ForwardModal.tsx`).

### 5. Draft Persistence Across Reloads
- Unsent composer input is synchronized to `localStorage` scoped per conversation ID (`chat_draft_<convId>`). Switching conversations or refreshing the browser restores unsent text seamlessly.

---

## 🧪 Automated Test Suite

Run the Vitest test suite covering memoized selectors, deduplication reducers, and message list behavioral rendering:

```bash
npm run test
```

For live watch mode:
```bash
npm run test:watch
```

---

## 🚀 Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

Key variables:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_chat"
AUTH_SECRET="your-32-character-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
```

### 3. Initialize Database
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 4. Run Development Servers
```bash
# Run both Next.js and Socket.IO concurrently:
npm run dev:all

# Or run them in separate terminals:
npm run dev      # Terminal 1: Next.js App (Port 3000)
npm run socket   # Terminal 2: Socket.IO Server (Port 3001)
```

Open **http://localhost:3000** in your browser.

---

## 📌 Production Architecture Considerations

1. **Horizontal Socket.IO Scaling & Clustering**:
   - The Socket.IO server uses in-memory presence tracking (`Map<userId, Set<socketId>>`) optimal for single-process deployments. For horizontal scaling across multiple container instances, a Redis adapter (`@socket.io/redis-adapter`) and Redis sets should be configured for distributed presence and event broadcasting.

2. **Persistent Read Status**:
   - Server-side read status is stored in PostgreSQL via the `Membership.lastReadAt` timestamp and managed through the `/api/conversations/[id]/read` endpoint. Unread badges are computed against unread message timestamps.

3. **Responsive Mobile Layout**:
   - Mobile devices ($\le 768\text{px}$) automatically toggle between the conversations list and the active chat panel, with a native back button in the header.

