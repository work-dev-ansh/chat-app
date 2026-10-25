import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import MessageList from "./MessageList";
import { ReduxProvider } from "@/components/providers/ReduxProvider";
import type { ChatMessage } from "@/contracts/message";

describe("MessageList Component", () => {
  const mockMessages: ChatMessage[] = [
    {
      id: "msg-1",
      conversationId: "conv-1",
      senderId: "user-2",
      content: "Hello there from Sarah!",
      type: "text",
      createdAt: new Date().toISOString(),
    },
    {
      id: "msg-2",
      conversationId: "conv-1",
      senderId: "user-1",
      content: "Hi Sarah, working on the real-time chat feature.",
      type: "text",
      createdAt: new Date().toISOString(),
    },
  ];

  it("renders messages with correct sender alignment and content", () => {
    render(
      <ReduxProvider>
        <MessageList messages={mockMessages} currentUserId="user-1" peerName="Sarah Jenkins" />
      </ReduxProvider>,
    );

    expect(screen.getByText("Hello there from Sarah!")).toBeInTheDocument();
    expect(screen.getByText("Sarah Jenkins")).toBeInTheDocument();
    expect(screen.getByText("Hi Sarah, working on the real-time chat feature.")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("renders forwarded tag when a message has isForwarded set to true", () => {
    const forwardedMsg: ChatMessage[] = [
      {
        id: "msg-3",
        conversationId: "conv-1",
        senderId: "user-2",
        content: "Important forwarded announcement",
        type: "text",
        isForwarded: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const { container } = render(
      <ReduxProvider>
        <MessageList messages={forwardedMsg} currentUserId="user-1" />
      </ReduxProvider>,
    );

    expect(screen.getByText("Important forwarded announcement")).toBeInTheDocument();
    expect(container.querySelector(".forwarded-tag")).toBeInTheDocument();
  });

  it("renders empty state and omits Today divider when message list is empty", () => {
    render(
      <ReduxProvider>
        <MessageList messages={[]} currentUserId="user-1" />
      </ReduxProvider>,
    );

    expect(
      screen.getByText("No messages yet. Say hello to start the conversation!"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("renders sending status for own outgoing message", () => {
    const sendingMessages: ChatMessage[] = [
      {
        id: "temp-msg-1",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "I am sending this right now",
        type: "text",
        status: "sending",
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <ReduxProvider>
        <MessageList messages={sendingMessages} currentUserId="user-1" />
      </ReduxProvider>,
    );

    expect(screen.getByText("I am sending this right now")).toBeInTheDocument();
    expect(screen.getByText(/Sending…/)).toBeInTheDocument();
  });

  it("renders failed status for own outgoing message", () => {
    const failedMessages: ChatMessage[] = [
      {
        id: "temp-msg-2",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "This message failed to send",
        type: "text",
        status: "failed",
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <ReduxProvider>
        <MessageList messages={failedMessages} currentUserId="user-1" />
      </ReduxProvider>,
    );

    expect(screen.getByText("This message failed to send")).toBeInTheDocument();
    expect(screen.getByText(/Failed to send/)).toBeInTheDocument();
  });

  it("does not render delivery status indicator for peer messages", () => {
    const peerMessages: ChatMessage[] = [
      {
        id: "peer-msg-1",
        conversationId: "conv-1",
        senderId: "user-2",
        content: "Incoming peer message with sending status",
        type: "text",
        status: "sending",
        createdAt: new Date().toISOString(),
      },
      {
        id: "peer-msg-2",
        conversationId: "conv-1",
        senderId: "user-2",
        content: "Incoming peer message with failed status",
        type: "text",
        status: "failed",
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <ReduxProvider>
        <MessageList messages={peerMessages} currentUserId="user-1" />
      </ReduxProvider>,
    );

    expect(screen.getByText("Incoming peer message with sending status")).toBeInTheDocument();
    expect(screen.getByText("Incoming peer message with failed status")).toBeInTheDocument();
    expect(screen.queryByText(/Sending…/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to send/)).not.toBeInTheDocument();
  });

  it("auto-scrolls to bottom on initial load and when near bottom", () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = render(
      <ReduxProvider>
        <MessageList messages={mockMessages} currentUserId="user-1" />
      </ReduxProvider>,
    );

    // Initial mount scrolls to bottom
    expect(scrollIntoViewMock).toHaveBeenCalled();
    scrollIntoViewMock.mockClear();

    // Adding a new message while near bottom scrolls to bottom
    const updatedMessages: ChatMessage[] = [
      ...mockMessages,
      {
        id: "msg-3",
        conversationId: "conv-1",
        senderId: "user-2",
        content: "Another new incoming message",
        type: "text",
        createdAt: new Date().toISOString(),
      },
    ];

    rerender(
      <ReduxProvider>
        <MessageList messages={updatedMessages} currentUserId="user-1" />
      </ReduxProvider>,
    );

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("preserves scroll position and does not auto-scroll when user has scrolled up", () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const { container, rerender } = render(
      <ReduxProvider>
        <MessageList messages={mockMessages} currentUserId="user-1" />
      </ReduxProvider>,
    );

    scrollIntoViewMock.mockClear();

    const listElement = container.querySelector(".message-list") as HTMLDivElement;
    expect(listElement).toBeInTheDocument();

    // Simulate user scrolled up:
    // scrollHeight = 1000, clientHeight = 400, scrollTop = 200 => distanceFromBottom = 400 > 80
    Object.defineProperty(listElement, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(listElement, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(listElement, "scrollTop", { configurable: true, value: 200 });

    act(() => {
      listElement.dispatchEvent(new Event("scroll"));
    });

    // Add a new message
    const updatedMessages: ChatMessage[] = [
      ...mockMessages,
      {
        id: "msg-4",
        conversationId: "conv-1",
        senderId: "user-2",
        content: "Background message while reading history",
        type: "text",
        createdAt: new Date().toISOString(),
      },
    ];

    rerender(
      <ReduxProvider>
        <MessageList messages={updatedMessages} currentUserId="user-1" />
      </ReduxProvider>,
    );

    // Should NOT auto-scroll because user scrolled up
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});
