import { handlers } from "@/auth";

/**
 * NextAuth v5 wildcard authentication route handler.
 * Serves OAuth provider callbacks, sign-in, sign-out, and active session queries.
 */
export const { GET, POST } = handlers;

