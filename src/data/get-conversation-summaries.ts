import type { ConversationSummary } from "@/contracts/conversation-summary";
import type { ChatMessage } from "@/contracts/message";
import { conversations } from "@/data/conversations";
import { people } from "@/data/people";
import { presence } from "@/data/presence";

/**
 * Derives ConversationSummary list for a specific user from normalized mock datasets.
 * In a real backend, this matches a query like `findSummariesForUser(userId)`.
 */
export function getConversationSummaries(
    currentUserId: string,
    currentMessages: ChatMessage[],
): ConversationSummary[] {
    const peopleMap = new Map(people.map((p) => [p.id, p]));
    const presenceMap = new Map(presence.map((pr) => [pr.personId, pr.status]));

    // Find conversations where current user is a participant
    const userConversations = conversations.filter((c) =>
        c.participantIds.includes(currentUserId),
    );

    return userConversations.map((c) => {
        // In direct chat, find peer (the other participant)
        const peerId = c.participantIds.find((id) => id !== currentUserId);
        const peer = peerId ? peopleMap.get(peerId) : undefined;

        // Find messages belonging to this conversation and get the latest
        const convMessages = currentMessages
            .filter((m) => m.conversationId === c.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const last = convMessages[convMessages.length - 1];

        const title = peer?.name ?? "Direct Message";
        const avatarUrl = peer?.avatarUrl;
        const presenceStatus = peerId ? presenceMap.get(peerId) ?? "offline" : undefined;

        return {
            id: c.id,
            type: c.type,
            title,
            avatarUrl,
            presence: presenceStatus,
            lastMessage: last
                ? {
                      id: last.id,
                      content: last.content,
                      senderId: last.senderId,
                      createdAt: last.createdAt,
                  }
                : undefined,
            unreadCount: 0,
        };
    });
}
