import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import MessageComposer from "./MessageComposer";
import { ReduxProvider } from "@/components/providers/ReduxProvider";
import { CHAT_CONFIG } from "@/constants/chat";

describe("MessageComposer Component", () => {
  const onSendMessageMock = vi.fn();
  const onTypingMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderComposer(conversationName = "Alice") {
    return render(
      <ReduxProvider>
        <MessageComposer
          conversationName={conversationName}
          onSendMessage={onSendMessageMock}
          onTyping={onTypingMock}
        />
      </ReduxProvider>,
    );
  }

  it("renders with placeholder and disabled send button when input is empty", () => {
    renderComposer("Alice");

    const input = screen.getByPlaceholderText(/Message Alice\.\.\./i);
    expect(input).toBeInTheDocument();

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it("disables send button and does not submit for whitespace-only text", () => {
    renderComposer("Alice");

    const input = screen.getByPlaceholderText(/Message Alice\.\.\./i);
    fireEvent.change(input, { target: { value: "    " } });

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();

    fireEvent.submit(sendButton.closest("form")!);
    expect(onSendMessageMock).not.toHaveBeenCalled();
  });

  it("enables send button and submits trimmed message content", () => {
    renderComposer("Alice");

    const input = screen.getByPlaceholderText(/Message Alice\.\.\./i);
    fireEvent.change(input, { target: { value: "  Hello world!  " } });

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).not.toBeDisabled();

    fireEvent.click(sendButton);

    expect(onSendMessageMock).toHaveBeenCalledTimes(1);
    expect(onSendMessageMock).toHaveBeenCalledWith("Hello world!", undefined);

    // Input clears after successful dispatch
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("notifies onTyping when typing and ceases on empty", () => {
    renderComposer("Alice");

    const input = screen.getByPlaceholderText(/Message Alice\.\.\./i);
    fireEvent.change(input, { target: { value: "typing something..." } });

    expect(onTypingMock).toHaveBeenCalledWith(true);

    fireEvent.change(input, { target: { value: "" } });
    expect(onTypingMock).toHaveBeenCalledWith(false);
  });

  it("prevents duplicate synchronous submissions from rapid double-clicks or rapid submit events", () => {
    renderComposer("Alice");

    const input = screen.getByPlaceholderText(/Message Alice\.\.\./i);
    fireEvent.change(input, { target: { value: "Single message test" } });

    const form = input.closest("form")!;

    // Rapid consecutive submits
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(onSendMessageMock).toHaveBeenCalledTimes(1);
  });

  it("enforces MAX_MESSAGE_LENGTH limit attribute and validation", () => {
    renderComposer("Alice");

    const input = screen.getByPlaceholderText(/Message Alice\.\.\./i) as HTMLInputElement;
    expect(input).toHaveAttribute("maxLength", String(CHAT_CONFIG.MAX_MESSAGE_LENGTH));

    const overlyLongText = "A".repeat(CHAT_CONFIG.MAX_MESSAGE_LENGTH + 10);
    fireEvent.change(input, { target: { value: overlyLongText } });

    const form = input.closest("form")!;
    fireEvent.submit(form);

    // Submission should be blocked
    expect(onSendMessageMock).not.toHaveBeenCalled();
  });

  it("preserves input text if onSendMessage throws synchronously", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    onSendMessageMock.mockImplementationOnce(() => {
      throw new Error("Immediate dispatch failure");
    });

    renderComposer("Alice");

    const input = screen.getByPlaceholderText(/Message Alice\.\.\./i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Draft to preserve" } });

    const form = input.closest("form")!;
    fireEvent.submit(form);

    // Input text should be preserved so the user does not lose their draft
    expect(input.value).toBe("Draft to preserve");
    expect(consoleErrorSpy).toHaveBeenCalledWith("Message dispatch failed:", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("permits successive legitimate messages after the current submit event completes", async () => {
    renderComposer("Alice");

    const input = screen.getByPlaceholderText(/Message Alice\.\.\./i) as HTMLInputElement;
    const form = input.closest("form")!;

    // Send first message
    fireEvent.change(input, { target: { value: "First message" } });
    fireEvent.submit(form);
    expect(onSendMessageMock).toHaveBeenCalledWith("First message", undefined);

    // Yield macro-task to simulate user typing and sending the next message
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Send second message
    fireEvent.change(input, { target: { value: "Second message" } });
    fireEvent.submit(form);
    expect(onSendMessageMock).toHaveBeenCalledWith("Second message", undefined);
    expect(onSendMessageMock).toHaveBeenCalledTimes(2);
  });

  it("retains pending media when user types text after uploading media", async () => {
    const { chatApi } = await import("@/services/chat-api");
    const uploadSpy = vi.spyOn(chatApi.media, "upload").mockResolvedValueOnce({
      url: "https://res.cloudinary.com/test/image/upload/sample.jpg",
      type: "image",
      originalName: "sample.jpg",
      size: 1024,
    });

    renderComposer("Alice");

    const fileInput = screen.getByTestId("composer-file-input");
    const file = new File(["dummy content"], "sample.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for the media upload promise to resolve
    await screen.findByText("sample.jpg");

    const input = screen.getByPlaceholderText(/Message Alice\.\.\./i) as HTMLInputElement;
    // Simulate user typing text AFTER uploading the media
    fireEvent.change(input, { target: { value: "Check out this image" } });

    // Ensure pending media preview is STILL visible and not wiped out by draft effect
    expect(screen.getByText("sample.jpg")).toBeInTheDocument();

    const form = input.closest("form")!;
    fireEvent.submit(form);

    expect(onSendMessageMock).toHaveBeenCalledTimes(1);
    expect(onSendMessageMock).toHaveBeenCalledWith("Check out this image", {
      url: "https://res.cloudinary.com/test/image/upload/sample.jpg",
      type: "image",
      name: "sample.jpg",
    });

    uploadSpy.mockRestore();
  });
});

