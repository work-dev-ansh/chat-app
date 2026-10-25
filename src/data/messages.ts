import type { ChatMessage } from "@/contracts/message";

export const messages: ChatMessage[] = [
    {
        id: "msg-1",
        conversationId: "conversation-1",
        senderId: "user-2",
        content: "Hey! Have we finalized the new chat experience?",
        type: "text",
        createdAt: "2026-10-24T10:32:00.000Z",
    },
    {
        id: "msg-2",
        conversationId: "conversation-1",
        senderId: "user-1",
        content:
            "I'm building the foundation now. Keeping the UI separate from the backend contracts.",
        type: "text",
        createdAt: "2026-10-24T10:33:00.000Z",
    },
    {
        id: "msg-3",
        conversationId: "conversation-1",
        senderId: "user-2",
        content: "Perfect. Let's make sure it works well on mobile too.",
        type: "text",
        createdAt: "2026-10-24T10:34:00.000Z",
    },
    {
        id: "msg-4",
        conversationId: "conversation-2",
        senderId: "user-3",
        content: "Hey Anshuman, thanks for reviewing the PR!",
        type: "text",
        createdAt: "2026-10-24T09:15:00.000Z",
    },
    {
        id: "msg-5",
        conversationId: "conversation-2",
        senderId: "user-1",
        content: "Looks great, let's merge it shortly.",
        type: "text",
        createdAt: "2026-10-24T09:20:00.000Z",
    },
];