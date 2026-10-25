import ChatWorkspace from "@/components/chats/ChatWorkspace";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <ChatWorkspace />;
}

