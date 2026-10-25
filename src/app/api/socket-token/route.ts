import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { encode } from "@auth/core/jwt";

/**
 * HTTP Handler: GET /api/socket-token
 * Issues a signed token for authenticated WebSocket connection handshakes.
 */
export async function GET() {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const secret =
      process.env.AUTH_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      "simuphish-development-secret-key-32chars";

    const token = await encode({
      token: {
        id: user.id,
        name: user.name,
        email: user.email,
        sub: user.id,
      },
      secret,
      maxAge: 30 * 24 * 60 * 60, // 30 days
      salt: "authjs.session-token",
    });

    return NextResponse.json({ data: { token } });
  } catch (error) {
    console.error("Failed to generate socket token:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
