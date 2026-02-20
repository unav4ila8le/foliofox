import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";

import { Chat } from "@/components/dashboard/layout/right-sidebar/ai-advisor/chat";
import { MAX_CONVERSATIONS_PER_USER } from "@/lib/ai/chat-guardrails-config";

const hoistedMocks = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  chatError: null as Error | null,
  promptSubmitPayload: { text: "hello", files: [] as unknown[] },
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
  MessageLoading: () => null,
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

vi.mock("@/components/ai-elements/tool", () => ({
  Tool: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ToolHeader: () => null,
  ToolInput: () => null,
  ToolOutput: () => null,
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
    onSubmit: (value: { text?: string; files?: unknown[] }) => void;
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
      value: "hello",
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
      messages: [],
      sendMessage: hoistedMocks.sendMessageMock,
      status: "ready",
      stop: vi.fn(),
      regenerate: vi.fn(),
    };
  },
}));

describe("Chat guardrail UI", () => {
  beforeEach(() => {
    cleanup();
    hoistedMocks.chatError = null;
    hoistedMocks.promptSubmitPayload = { text: "hello", files: [] };
    hoistedMocks.sendMessageMock.mockReset();
  });

  it("shows proactive conversation-cap alert for unsaved thread", () => {
    render(
      <Chat
        conversationId="conversation-1"
        initialMessages={[]}
        isLoadingConversation={false}
        copiedMessages={new Set()}
        setCopiedMessages={() => {}}
        isAIEnabled
        isAtConversationCap
        maxConversations={MAX_CONVERSATIONS_PER_USER}
        hasCurrentConversationInHistory={false}
      />,
    );

    expect(
      screen.getByText("Conversation limit reached", { exact: false }),
    ).not.toBeNull();
    expect(
      screen.getByText(/Delete an older conversation/, { exact: false }),
    ).not.toBeNull();
  });

  it("surfaces backend errors in the chat panel", () => {
    hoistedMocks.chatError = new Error("server exploded");

    render(
      <Chat
        conversationId="conversation-2"
        initialMessages={[]}
        isLoadingConversation={false}
        copiedMessages={new Set()}
        setCopiedMessages={() => {}}
        isAIEnabled
        isAtConversationCap={false}
        maxConversations={MAX_CONVERSATIONS_PER_USER}
        hasCurrentConversationInHistory
      />,
    );

    expect(screen.getByText("Chat request failed")).not.toBeNull();
    expect(screen.getByText("server exploded")).not.toBeNull();
  });

  it("clears backend error after the user submits a new message", () => {
    hoistedMocks.chatError = new Error("temporary backend error");

    render(
      <Chat
        conversationId="conversation-3"
        initialMessages={[]}
        isLoadingConversation={false}
        copiedMessages={new Set()}
        setCopiedMessages={() => {}}
        isAIEnabled
        isAtConversationCap={false}
        maxConversations={MAX_CONVERSATIONS_PER_USER}
        hasCurrentConversationInHistory
      />,
    );

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
        copiedMessages={new Set()}
        setCopiedMessages={() => {}}
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
        copiedMessages={new Set()}
        setCopiedMessages={() => {}}
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

    render(
      <Chat
        conversationId="conversation-files"
        initialMessages={[]}
        isLoadingConversation={false}
        copiedMessages={new Set()}
        setCopiedMessages={() => {}}
        isAIEnabled
        isAtConversationCap={false}
        maxConversations={MAX_CONVERSATIONS_PER_USER}
        hasCurrentConversationInHistory
      />,
    );

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
});
