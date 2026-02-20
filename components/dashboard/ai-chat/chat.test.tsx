import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";

import { Chat } from "@/components/dashboard/ai-chat/chat";
import { MAX_CONVERSATIONS_PER_USER } from "@/lib/ai/chat-guardrails-config";

const hoistedMocks = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  regenerateMock: vi.fn(),
  chatError: null as Error | null,
  promptSubmitPayload: { text: "hello", files: [] as unknown[] },
  messages: [] as unknown[],
  status: "ready" as "ready" | "streaming" | "submitted",
}));

vi.mock("@/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copyToClipboard: vi.fn() }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ai-elements/conversation", () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ConversationContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ConversationEmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  ConversationScrollButton: () => null,
}));

vi.mock("@/components/ai-elements/message", () => ({
  Message: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MessageAttachments: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="message-attachments">{children}</div>
  ),
  MessageAttachment: ({ data }: { data: { filename?: string } }) => (
    <div>{`attachment:${data.filename ?? "unknown"}`}</div>
  ),
  MessageContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MessageResponse: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MessageActions: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MessageAction: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ai-elements/message-loading", () => ({
  MessageLoading: () => <div>Loading...</div>,
}));

vi.mock("@/components/ai-elements/reasoning", () => ({
  Reasoning: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ReasoningContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ReasoningTrigger: () => null,
}));

vi.mock("@/components/ai-elements/sources", () => ({
  Sources: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SourcesTrigger: ({ count }: { count: number }) => (
    <div>{`Used ${count} sources`}</div>
  ),
  SourcesContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Source: ({ title }: { title?: string }) => <div>{title}</div>,
}));

vi.mock("@/components/ai-elements/tool", () => ({
  Tool: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ToolHeader: ({ type, state }: { type: string; state: string }) => (
    <div>{`tool:${type}:${state}`}</div>
  ),
  ToolInput: ({ input }: { input: unknown }) => (
    <div>{`tool-input:${JSON.stringify(input)}`}</div>
  ),
  ToolOutput: ({
    output,
    errorText,
  }: {
    output: unknown;
    errorText?: string;
  }) => <div>{`tool-output:${errorText ?? JSON.stringify(output)}`}</div>,
}));

vi.mock("@/components/ai-elements/prompt-input", () => ({
  PromptInputProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInput: ({
    children,
    onSubmit,
  }: {
    children: React.ReactNode;
    onSubmit: (value: { text: string; files: unknown[] }) => void;
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(hoistedMocks.promptSubmitPayload);
      }}
    >
      {children}
    </form>
  ),
  PromptInputTextarea: () => <textarea aria-label="prompt" />,
  PromptInputSubmit: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="submit" {...props}>
      Send
    </button>
  ),
  PromptInputTools: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputAttachments: ({
    children,
  }: {
    children: (attachment: unknown) => React.ReactNode;
  }) => <div>{children({ id: "file-1" })}</div>,
  PromptInputAttachment: () => null,
  PromptInputActionMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputActionMenuTrigger: () => null,
  PromptInputActionMenuContent: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div>{children}</div>,
  PromptInputActionAddAttachments: () => null,
  PromptInputBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputSelect: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputSelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputSelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputSelectItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputSelectValue: () => null,
  PromptInputFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputSpeechButton: () => null,
  usePromptInputController: () => ({
    textInput: {
      value: hoistedMocks.promptSubmitPayload.text,
      setInput: vi.fn(),
    },
    attachments: {
      files: hoistedMocks.promptSubmitPayload.files,
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      openFileDialog: vi.fn(),
      fileInputRef: { current: null },
    },
  }),
}));

vi.mock("@/components/features/ai-settings/dialog", () => ({
  AISettingsDialog: () => null,
}));

vi.mock("@/components/ui/logos/logomark", () => ({
  Logomark: () => <div>logo</div>,
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: ({ onError }: { onError?: (error: Error) => void }) => {
    if (hoistedMocks.chatError) {
      const error = hoistedMocks.chatError;
      hoistedMocks.chatError = null;
      onError?.(error);
    }

    return {
      messages: hoistedMocks.messages,
      sendMessage: hoistedMocks.sendMessageMock,
      status: hoistedMocks.status,
      stop: vi.fn(),
      regenerate: hoistedMocks.regenerateMock,
    };
  },
}));

function renderChat(
  overrides: Partial<React.ComponentProps<typeof Chat>> = {},
) {
  return render(
    <Chat
      conversationId="conversation-1"
      initialMessages={[]}
      isLoadingConversation={false}
      isAIEnabled
      isAtConversationCap={false}
      maxConversations={MAX_CONVERSATIONS_PER_USER}
      hasCurrentConversationInHistory
      {...overrides}
    />,
  );
}

describe("Chat guardrail UI", () => {
  beforeEach(() => {
    cleanup();
    hoistedMocks.chatError = null;
    hoistedMocks.promptSubmitPayload = { text: "hello", files: [] };
    hoistedMocks.messages = [];
    hoistedMocks.status = "ready";
    hoistedMocks.sendMessageMock.mockReset();
    hoistedMocks.regenerateMock.mockReset();
  });

  it("shows proactive conversation-cap alert for unsaved thread", () => {
    renderChat({
      isAtConversationCap: true,
      hasCurrentConversationInHistory: false,
    });

    expect(
      screen.getByText("Conversation limit reached", { exact: false }),
    ).not.toBeNull();
    expect(
      screen.getByText(/Delete an older conversation/, { exact: false }),
    ).not.toBeNull();
  });

  it("surfaces backend errors in the chat panel", () => {
    hoistedMocks.chatError = new Error("server exploded");

    renderChat();

    expect(screen.getByText("Chat request failed")).not.toBeNull();
    expect(screen.getByText("server exploded")).not.toBeNull();
  });

  it("clears backend error after the user submits a new message", () => {
    hoistedMocks.chatError = new Error("temporary backend error");

    renderChat();

    expect(screen.getByText("temporary backend error")).not.toBeNull();

    const submitButton = screen.getAllByRole("button", { name: "Send" })[0];
    expect(submitButton).toBeDefined();
    fireEvent.click(submitButton as HTMLElement);

    expect(hoistedMocks.sendMessageMock).toHaveBeenCalledWith({
      text: "hello",
    });
    expect(screen.queryByText("temporary backend error")).toBeNull();
  });

  it("clears backend error when switching conversations with keyed remount", () => {
    hoistedMocks.chatError = new Error("previous conversation error");

    const { rerender } = render(
      <Chat
        key="conversation-4"
        conversationId="conversation-4"
        initialMessages={[]}
        isLoadingConversation={false}
        isAIEnabled
        isAtConversationCap={false}
        maxConversations={MAX_CONVERSATIONS_PER_USER}
        hasCurrentConversationInHistory
      />,
    );

    expect(screen.getByText("previous conversation error")).not.toBeNull();

    rerender(
      <Chat
        key="conversation-5"
        conversationId="conversation-5"
        initialMessages={[]}
        isLoadingConversation={false}
        isAIEnabled
        isAtConversationCap={false}
        maxConversations={MAX_CONVERSATIONS_PER_USER}
        hasCurrentConversationInHistory
      />,
    );

    expect(screen.queryByText("previous conversation error")).toBeNull();
  });

  it("submits file-only prompt payloads to useChat", () => {
    hoistedMocks.promptSubmitPayload = {
      text: "",
      files: [
        {
          type: "file",
          mediaType: "application/pdf",
          filename: "statement.pdf",
          url: "data:application/pdf;base64,Zm9v",
        },
      ],
    };

    renderChat();

    const submitButton = screen.getAllByRole("button", { name: "Send" })[0];
    expect(submitButton).toBeDefined();
    fireEvent.click(submitButton as HTMLElement);

    expect(hoistedMocks.sendMessageMock).toHaveBeenCalledWith({
      files: [
        {
          type: "file",
          mediaType: "application/pdf",
          filename: "statement.pdf",
          url: "data:application/pdf;base64,Zm9v",
        },
      ],
    });
  });

  it("does not submit text messages shorter than 2 characters", () => {
    hoistedMocks.promptSubmitPayload = { text: "a", files: [] };

    renderChat();

    const submitButton = screen.getAllByRole("button", { name: "Send" })[0];
    expect(submitButton).toBeDefined();
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(submitButton as HTMLElement);

    expect(hoistedMocks.sendMessageMock).not.toHaveBeenCalled();
  });

  it("disables prompt input submit when AI is disabled", () => {
    renderChat({ isAIEnabled: false });

    const submitButton = screen.getAllByRole("button", { name: "Send" })[0];
    expect(submitButton).toBeDefined();
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(submitButton as HTMLElement);

    expect(hoistedMocks.sendMessageMock).not.toHaveBeenCalled();
  });

  it("renders user attachments and assistant sources from message parts", () => {
    hoistedMocks.messages = [
      {
        id: "message-user-1",
        role: "user",
        parts: [
          {
            type: "file",
            mediaType: "application/pdf",
            filename: "statement.pdf",
            url: "data:application/pdf;base64,Zm9v",
          },
          { type: "text", text: "Please review this statement" },
        ],
      },
      {
        id: "message-assistant-1",
        role: "assistant",
        parts: [
          {
            type: "source-url",
            url: "https://example.com/report",
            title: "External report",
          },
          {
            type: "source-document",
            title: "Portfolio memo",
            filename: "memo.pdf",
          },
          { type: "text", text: "Here is your summary." },
        ],
      },
    ];

    renderChat();

    expect(screen.getByText("attachment:statement.pdf")).not.toBeNull();
    expect(screen.getByText("Used 2 sources")).not.toBeNull();
    expect(screen.getByText("External report")).not.toBeNull();
    expect(screen.getByText("Portfolio memo")).not.toBeNull();
  });

  it("renders reasoning and static tool branches", () => {
    hoistedMocks.messages = [
      {
        id: "message-assistant-2",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "Thinking step 1" },
          { type: "reasoning", text: "Thinking step 2" },
          {
            type: "tool-position-lookup",
            state: "output-available",
            input: { ticker: "AAPL" },
            output: { price: 123.45 },
            errorText: undefined,
          },
          { type: "text", text: "AAPL is trading near 123." },
        ],
      },
    ];

    renderChat();

    expect(
      screen.getByText(/Thinking step 1\s+Thinking step 2/),
    ).not.toBeNull();
    expect(
      screen.getByText("tool:tool-position-lookup:output-available"),
    ).not.toBeNull();
    expect(screen.getByText('tool-input:{"ticker":"AAPL"}')).not.toBeNull();
    expect(screen.getByText('tool-output:{"price":123.45}')).not.toBeNull();
  });
});
