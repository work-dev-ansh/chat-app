"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Avatar, Badge, Button, Spinner, SettingsIcon } from "@anshuman/ui";
import { useState, useRef, useEffect } from "react";

/**
 * Profile & Account Switcher rendered at the bottom of the conversation sidebar.
 * Supports Google OAuth sign-in, quick demo account switching, and sign-out.
 */
export default function AuthProfileBar() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const demoAccounts = [
    { email: "anshuman@example.com", name: "Anshuman Singh" },
    { email: "sarah.chen@example.com", name: "Sarah Chen" },
    { email: "james.davis@example.com", name: "James Davis" },
    { email: "elena.rostova@example.com", name: "Elena Rostova" },
  ];

  if (status === "loading") {
    return (
      <div className="sidebar-profile">
        <Spinner size="sm" />
        <span className="text-xs text-muted">Authenticating...</span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="sidebar-auth-prompt">
        <Button
          variant="secondary"
          size="md"
          className="google-signin-btn"
          onClick={() => signIn("google", { redirectTo: "/" })}
          type="button"
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="16" height="16">
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
          <span>Sign in with Google</span>
        </Button>

        <div className="demo-switch-header">Quick Demo Login:</div>
        <div className="demo-account-chips">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              className="demo-chip"
              onClick={() => signIn("credentials", { email: account.email })}
            >
              {account.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const user = session.user;

  return (
    <div className="sidebar-profile-container" ref={containerRef}>
      <button
        type="button"
        className="sidebar-profile clickable"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
        aria-label="Account options"
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          font: "inherit",
          color: "inherit",
        }}
      >
        <Avatar name={user.name ?? "User"} size="md" />
        <div className="profile-info">
          <div className="profile-name-row">
            <strong>{user.name}</strong>
            <Badge variant="success">Online</Badge>
          </div>
          <span>{user.email}</span>
        </div>
        <span className="profile-menu-caret">
          <SettingsIcon size={16} />
        </span>
      </button>


      {isMenuOpen && (
        <div className="profile-dropdown">
          <div className="dropdown-section">
            <span className="dropdown-label">Switch Local Account:</span>
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                className={`dropdown-item ${account.email === user.email ? "active" : ""}`}
                type="button"
                onClick={() => {
                  signIn("credentials", { email: account.email });
                  setIsMenuOpen(false);
                }}
              >
                <span>{account.name}</span>
                {account.email === user.email && <span className="text-xs font-semibold">Active</span>}
              </button>
            ))}
          </div>

          <div className="dropdown-divider" />

          <Button
            variant="danger"
            size="sm"
            className="dropdown-logout-btn"
            type="button"
            onClick={() => signOut()}
          >
            Sign Out
          </Button>
        </div>
      )}
    </div>
  );
}
