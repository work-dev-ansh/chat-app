import type { ConversationType } from "./conversation";
import type { PresenceStatus } from "./presence";

/**
 * Lightweight projection of a conversation optimized for sidebar navigation,
 * list rendering, and active room selection in Redux.
 */
export interface ConversationSummary {
  id: string;
  type: ConversationType;
  title: string;
  avatarUrl?: string;
  peerUserId?: string;
  presence?: PresenceStatus;
  memberCount?: number;
  participantNames?: string[];
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
}