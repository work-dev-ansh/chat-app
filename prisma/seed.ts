import { PrismaClient } from "@prisma/client";

/**
 * [BACKEND ONLY]
 * Seeds PostgreSQL with demo accounts, conversations, and initial chat history.
 */
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Clean existing records to allow repeatable runs
  await prisma.message.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed an enterprise team directory
  await prisma.user.createMany({
    data: [
      {
        id: "user-1",
        email: "anshuman@example.com",
        name: "Anshuman Singh",
        passwordHash: "placeholder-hash",
        avatarUrl: "https://ui.shadcn.com/img/avatars/04.png",
      },
      {
        id: "user-2",
        email: "sarah.chen@example.com",
        name: "Sarah Chen",
        passwordHash: "placeholder-hash",
        avatarUrl: "https://ui.shadcn.com/img/avatars/01.png",
      },
      {
        id: "user-3",
        email: "james.davis@example.com",
        name: "James Davis",
        passwordHash: "placeholder-hash",
        avatarUrl: "https://ui.shadcn.com/img/avatars/02.png",
      },
      {
        id: "user-4",
        email: "elena.rostova@example.com",
        name: "Elena Rostova",
        passwordHash: "placeholder-hash",
        avatarUrl: "https://ui.shadcn.com/img/avatars/03.png",
      },
      {
        id: "user-5",
        email: "marcus.vance@example.com",
        name: "Marcus Vance",
        passwordHash: "placeholder-hash",
        avatarUrl: "https://ui.shadcn.com/img/avatars/05.png",
      },
      {
        id: "user-6",
        email: "priya.patel@example.com",
        name: "Priya Patel",
        passwordHash: "placeholder-hash",
      },
      {
        id: "user-7",
        email: "alex.kim@example.com",
        name: "Alex Kim",
        passwordHash: "placeholder-hash",
      },
      {
        id: "user-8",
        email: "olivia.taylor@example.com",
        name: "Olivia Taylor",
        passwordHash: "placeholder-hash",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding complete! Created 8 directory users (Anshuman, Sarah, James, Elena, Marcus, Priya, Alex, Olivia).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
