import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatPage from "./page";

// Mock ChatWorkspace to isolate routing test and verify it is rendered
vi.mock("@/components/chats/ChatWorkspace", () => ({
  default: () => <div data-testid="chat-workspace">Mocked Chat Workspace</div>,
}));

describe("/chat route (ChatPage)", () => {
  it("renders the primary ChatWorkspace component instead of an unstyled placeholder stub", () => {
    render(<ChatPage />);

    const workspace = screen.getByTestId("chat-workspace");
    expect(workspace).toBeInTheDocument();
    expect(workspace).toHaveTextContent("Mocked Chat Workspace");
    expect(screen.queryByText("Chat")).not.toBeInTheDocument();
  });
});
