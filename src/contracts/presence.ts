export type PresenceStatus = "online" | "offline" | "away";

export interface Presence {
  personId: string;
  status: PresenceStatus;
  lastActiveAt?: string;
}