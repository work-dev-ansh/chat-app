/**
 * Discriminator identifying direct 1-on-1 chats versus multi-participant channels.
 */
export type ConversationType = "direct" | "group";

export interface Conversation {
  id: string;
  type: ConversationType;
  participantIds: string[];
  createdAt: string;
}