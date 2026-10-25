import { NextResponse } from "next/server";
import { auth } from "@/auth";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export async function requireAuth(): Promise<
  | { user: AuthenticatedUser; errorResponse: null }
  | { user: null; errorResponse: NextResponse }
> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: You must be signed in to perform this action" },
        { status: 401 },
      ),
    };
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name ?? "User",
      email: session.user.email ?? "",
      image: session.user.image,
    },
    errorResponse: null,
  };
}
