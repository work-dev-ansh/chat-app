import LoginView from "@/components/auth/LoginView";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign In - NexusChat",
  description: "Enterprise real-time chat sign-in with Google OAuth and demo personas",
};

export default async function LoginPage() {
  const session = await auth();

  // If already logged in, redirect to chat
  if (session?.user) {
    redirect("/chat");
  }

  return <LoginView />;
}
