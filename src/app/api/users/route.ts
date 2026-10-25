import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/prisma";
import { requireAuth } from "@/lib/server-auth";

/**
 * HTTP Handler: GET /api/users
 * Returns list of team members available for direct or group conversations,
 * excluding the authenticated session user.
 */
export async function GET() {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const users = await prisma.user.findMany({
      where: {
        id: { not: user.id },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
      orderBy: { name: "asc" },
    });

    const normalizedUsers = users.map((u) => ({
      id: u.id,
      name: u.name?.trim() || "Unknown User",
      email: u.email,
      avatarUrl: u.avatarUrl,
    }));

    return NextResponse.json({ data: normalizedUsers });
  } catch (error: unknown) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

