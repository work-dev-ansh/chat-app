"use client";

import { signIn } from "next-auth/react";
import { Avatar, Badge, Spinner } from "@anshuman/ui";
import { useState } from "react";

interface LoginViewProps {
  isLoading?: boolean;
}

const DEMO_ACCOUNTS = [
  {
    email: "anshuman@example.com",
    name: "Anshuman Singh",
    role: "Full-Stack Lead",
    avatar: "https://ui.shadcn.com/img/avatars/04.png",
    initials: "AS",
  },
  {
    email: "sarah.chen@example.com",
    name: "Sarah Chen",
    role: "Product Manager",
    avatar: "https://ui.shadcn.com/img/avatars/01.png",
    initials: "SC",
  },
  {
    email: "james.davis@example.com",
    name: "James Davis",
    role: "Backend Architect",
    avatar: "https://ui.shadcn.com/img/avatars/02.png",
    initials: "JD",
  },
  {
    email: "elena.rostova@example.com",
    name: "Elena Rostova",
    role: "SecOps Specialist",
    avatar: "https://ui.shadcn.com/img/avatars/03.png",
    initials: "ER",
  },
];

export default function LoginView({ isLoading }: LoginViewProps) {
  const [signingInEmail, setSigningInEmail] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  const handleDemoSignIn = async (email: string) => {
    try {
      setSigningInEmail(email);
      await signIn("credentials", { email, redirectTo: "/chat" });
    } catch (err) {
      console.error("Demo sign-in failed:", err);
      setSigningInEmail(null);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleSigningIn(true);
      await signIn("google", { redirectTo: "/chat" });
    } catch (err) {
      console.error("Google sign-in failed:", err);
      setIsGoogleSigningIn(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Background ambient lighting */}
      <div className="login-bg-glow-1" />
      <div className="login-bg-glow-2" />

      <main className="login-card-wrapper" role="main">
        {/* Brand header */}
        <div className="login-brand-header">
          <div className="login-brand-icon">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="login-title">Welcome to NexusChat</h1>
          <p className="login-subtitle">
            Enterprise real-time messaging with WebSocket sync, PostgreSQL persistence, and OAuth 2.0
          </p>
        </div>

        {/* Primary OAuth Method */}
        <div className="login-section">
          <button
            type="button"
            className="login-google-btn"
            onClick={handleGoogleSignIn}
            disabled={isGoogleSigningIn || Boolean(signingInEmail)}
            aria-label="Sign in with Google"
          >
            {isGoogleSigningIn ? (
              <>
                <Spinner size="sm" />
                <span>Connecting with Google...</span>
              </>
            ) : (
              <>
                <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="google-btn-text">Continue with Google (OAuth 2.0)</span>
                <span className="oauth-pill">Recommended</span>
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="login-divider">
          <span>OR TEST WITH DEMO TEAM ACCOUNTS</span>
        </div>

        {/* Demo Fast Switch Section */}
        <div className="login-demo-section">
          <p className="login-demo-desc">
            Quickly test multi-user conversations, presence tracking, and typing indicators:
          </p>
          <div className="login-demo-grid">
            {DEMO_ACCOUNTS.map((account) => {
              const isSelected = signingInEmail === account.email;
              return (
                <button
                  key={account.email}
                  type="button"
                  className={`login-demo-card ${isSelected ? "loading" : ""}`}
                  onClick={() => handleDemoSignIn(account.email)}
                  disabled={Boolean(signingInEmail) || isGoogleSigningIn}
                >
                  <Avatar name={account.name} size="md" />
                  <div className="login-demo-meta">
                    <div className="login-demo-name">{account.name}</div>
                    <div className="login-demo-role">{account.role}</div>
                  </div>
                  {isSelected ? (
                    <Spinner size="sm" />
                  ) : (
                    <span className="demo-enter-arrow">→</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Technical architecture footer notice */}
        <div className="login-footer-info">
          <Badge variant="primary">NextAuth v5 + JWT</Badge>
          <Badge variant="neutral">Socket.IO Handshake Auth</Badge>
          <Badge variant="success">PostgreSQL Active</Badge>
        </div>
      </main>
    </div>
  );
}
