import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ConversationSidebar from "./ConversationSidebar";
import { ReduxProvider } from "@/components/providers/ReduxProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import type { ConversationSummary } from "@/contracts/conversation-summary";

describe("ConversationSidebar Component", () => {
  const mockConversations: ConversationSummary[] = [
    {
      id: "conv-1",
      type: "direct",
      title: "Sarah Connor",
      presence: "online",
      unreadCount: 3,
      lastMessage: {
        id: "msg-1",
        content: "Hey, are you free to review?",
        senderId: "user-2",
        createdAt: "2026-10-25T10:00:00.000Z",
      },
    },
    {
      id: "conv-2",
      type: "direct",
      title: "John Doe",
      presence: "offline",
      unreadCount: 0,
      lastMessage: {
        id: "msg-2",
        content: "Will check tomorrow",
        senderId: "user-3",
        createdAt: "2026-10-24T18:00:00.000Z",
      },
    },
    {
      id: "conv-3",
      type: "group",
      title: "Frontend Team",
      presence: "offline",
      unreadCount: 0,
      lastMessage: {
        id: "msg-3",
        content: "   ", // whitespace only
        senderId: "user-4",
        createdAt: "2026-10-25T09:00:00.000Z",
      },
    },
  ];

  function renderSidebar(props: Partial<React.ComponentProps<typeof ConversationSidebar>> = {}) {
    const defaultProps: React.ComponentProps<typeof ConversationSidebar> = {
      conversations: mockConversations,
      selectedConversationId: "conv-1",
      onSelectConversation: vi.fn(),
      onOpenNewChat: vi.fn(),
      onForwardMessage: vi.fn(),
      ...props,
    };

    return {
      ...render(
        <AuthProvider session={null}>
          <ReduxProvider>
            <ConversationSidebar {...defaultProps} />
          </ReduxProvider>
        </AuthProvider>,
      ),
      props: defaultProps,
    };
  }

  it("renders conversation list with titles, presence indicators, and snippets", () => {
    renderSidebar();

    expect(screen.getByText("Sarah Connor")).toBeInTheDocument();
    expect(screen.getByText("Hey, are you free to review?")).toBeInTheDocument();

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Will check tomorrow")).toBeInTheDocument();

    expect(screen.getByText("Frontend Team")).toBeInTheDocument();
  });

  it("highlights active conversation and triggers onSelectConversation when clicked", () => {
    const onSelectConversation = vi.fn();
    renderSidebar({ selectedConversationId: "conv-1", onSelectConversation });

    const activeItem = screen.getByRole("button", { name: /Sarah Connor/i });
    expect(activeItem).toHaveClass("active");
    expect(activeItem).toHaveAttribute("aria-pressed", "true");

    const inactiveItem = screen.getByRole("button", { name: /John Doe/i });
    expect(inactiveItem).not.toHaveClass("active");
    expect(inactiveItem).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(inactiveItem);
    expect(onSelectConversation).toHaveBeenCalledWith("conv-2");
  });

  it("displays unread count badge when unreadCount > 0 and omits it when 0", () => {
    renderSidebar();

    // Sarah has unreadCount = 3
    expect(screen.getByText("3")).toBeInTheDocument();

    // John and Frontend Team have 0 unread, verify no "0" badge exists
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders empty state message when conversation list is empty", () => {
    renderSidebar({ conversations: [] });

    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
  });

  it("uses Attachment fallback when message content is blank or whitespace-only", () => {
    renderSidebar();

    // conv-3 has whitespace-only content
    expect(screen.getByText("Attachment")).toBeInTheDocument();
  });

  it("triggers onOpenNewChat when the New button is clicked", () => {
    const onOpenNewChat = vi.fn();
    renderSidebar({ onOpenNewChat });

    const newBtn = screen.getByRole("button", { name: "Start new conversation" });
    fireEvent.click(newBtn);

    expect(onOpenNewChat).toHaveBeenCalledTimes(1);
  });
});
