import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ConversationHeader from "./ConversationHeader";

describe("ConversationHeader Component", () => {
  it("renders conversation title correctly", () => {
    render(<ConversationHeader name="Engineering Team" isOnline={false} />);

    expect(screen.getByRole("heading", { level: 2, name: "Engineering Team" })).toBeInTheDocument();
  });

  it("renders online status badge and active session subtitle when isOnline is true", () => {
    render(<ConversationHeader name="Sarah Connor" isOnline={true} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("End-to-end encrypted session active")).toBeInTheDocument();
  });

  it("renders offline status badge and last seen subtitle when isOnline is false", () => {
    render(<ConversationHeader name="Sarah Connor" isOnline={false} />);

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByText("Last seen recently")).toBeInTheDocument();
  });

  it("renders accessible options action button", () => {
    render(<ConversationHeader name="Sarah Connor" isOnline={true} />);

    expect(screen.getByRole("button", { name: "Conversation options" })).toBeInTheDocument();
  });
});
