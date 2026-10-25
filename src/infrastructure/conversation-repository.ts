import { prisma } from "./prisma";

export const conversationRepository = {
  async createConversationWithPeer(userIds: string[], title?: string) {
    // 1. Validate the participant list.
    const sortedUserIds = [...new Set(userIds)].sort();

    if (sortedUserIds.length < 2) {
      throw new Error("A conversation requires at least two participants.");
    }

    if (sortedUserIds.length !== userIds.length) {
      throw new Error("Duplicate participant IDs are not allowed.");
    }

    // 2. Find candidate conversations containing only
    //    participants from the requested set (only for direct 1-on-1s without custom titles).
    if (!title && sortedUserIds.length === 2) {
      const candidates = await prisma.conversation.findMany({
        where: {
          memberships: {
            some: {
              userId: { in: sortedUserIds },
            },
            every: {
              userId: { in: sortedUserIds },
            },
          },
        },
        include: {
          memberships: {
            select: {
              userId: true,
            },
          },
        },
      });

      // 3. Check exact participant-set equality.
      const existingConversation = candidates.find((conversation) => {
        const existingUserIds = conversation.memberships
          .map((membership) => membership.userId)
          .sort();

        return (
          existingUserIds.length === sortedUserIds.length &&
          existingUserIds.every(
            (id, index) => id === sortedUserIds[index],
          )
        );
      });

      if (existingConversation) {
        return existingConversation;
      }
    }

    // 4. Create a conversation with all requested participants.
    return prisma.conversation.create({
      data: {
        title: title?.trim() || null,
        memberships: {
          create: sortedUserIds.map((userId) => ({
            userId,
          })),
        },
      },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  },

  /**
   * Fetches all conversations a user participates in,
   * projecting them into lightweight ConversationSummary objects for the sidebar.
   */
  async findSummariesForUser(userId: string) {
    const conversations = await prisma.conversation.findMany({
      where: {
        memberships: {
          some: { userId },
        },
      },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return conversations.map((conv) => {
      const isGroup = Boolean(conv.title) || conv.memberships.length > 2;
      const peerMemberships = conv.memberships.filter((m) => m.userId !== userId);
      const peer = peerMemberships[0]?.user;
      const lastMsg = conv.messages[0];

      let computedTitle = conv.title;
      if (!computedTitle) {
        if (isGroup) {
          const names = peerMemberships
            .map((m) => m.user.name)
            .filter(Boolean) as string[];
          computedTitle = names.length > 0 ? names.join(", ") : "Group Chat";
        } else {
          computedTitle = peer?.name ?? "Direct Message";
        }
      }

      const allParticipantNames = conv.memberships
        .map((m) => m.user.name)
        .filter(Boolean) as string[];

      return {
        id: conv.id,
        type: isGroup ? "group" : "direct",
        title: computedTitle,
        avatarUrl: isGroup ? undefined : (peer?.avatarUrl ?? undefined),
        peerUserId: isGroup ? undefined : peer?.id,
        presence: "offline",
        memberCount: conv.memberships.length,
        participantNames: allParticipantNames,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.text,
              senderId: lastMsg.senderId,
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : undefined,
        unreadCount: 0,
      };
    });
  },
};