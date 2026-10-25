import { Conversation } from "@/contracts/conversation";

export const conversations: Conversation[] = [
    {
        id: "conversation-1",
        type: "direct",
        participantIds: ["user-1", "user-2"],
        createdAt: "2026-10-10T09:00:00.000Z",
    },
    {
        id: "conversation-2",
        type: "direct",
        participantIds: ["user-1", "user-3"],
        createdAt: "2026-10-11T10:00:00.000Z",
    },
];