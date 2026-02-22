import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AIChatPanel } from "@/components/dashboard/ai-chat/panel";
import { AIChatProvider } from "@/components/dashboard/ai-chat/provider";

import type React from "react";

const hoistedMocks = vi.hoisted(() => ({
  pathname: "/dashboard/assets",
  searchParams: "page=1",
  uuidValues: ["generated-conversation-1", "generated-conversation-2"],
  fetchConversations: vi.fn(async () => ({
    conversations: [
      {
        id: "conversation-a",
        title: "Conversation A",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    totalCount: 1,
    isAtCap: false,
    maxConversations: 10,
  })),
  fetchConversationMessages: vi.fn(async () => []),
}));

vi.mock("uuid", () => ({
  v4: () => hoistedMocks.uuidValues.shift() ?? "generated-fallback",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => hoistedMocks.pathname,
  useSearchParams: () => new URLSearchParams(hoistedMocks.searchParams),
}));

vi.mock("@/server/ai/conversations/fetch", () => ({
  fetchConversations: hoistedMocks.fetchConversations,
}));

vi.mock("@/server/ai/messages/fetch", () => ({
  fetchConversationMessages: hoistedMocks.fetchConversationMessages,
}));

vi.mock("@/components/ai-elements/prompt-input", () => ({
  PromptInputProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/dashboard/ai-chat/header", () => ({
  ChatHeader: ({
    onSelectConversation,
    onNewConversation,
    expandHref,
  }: {
    onSelectConversation: (id: string) => void;
    onNewConversation: () => void;
    expandHref?: string | null;
  }) => (
    <div>
      <button onClick={() => onSelectConversation("conversation-a")}>
        Select conversation A
      </button>
      <button onClick={onNewConversation}>New conversation</button>
      {expandHref ? <a href={expandHref}>Expand</a> : null}
    </div>
  ),
}));

vi.mock("@/components/dashboard/ai-chat/chat", () => ({
  Chat: ({
    conversationId,
    initialDraftInput,
    initialDraftMode,
    initialDraftFiles,
    onDraftInputChange,
    onDraftModeChange,
    onDraftFilesChange,
  }: {
    conversationId: string;
    initialDraftInput?: string;
    initialDraftMode?: string;
    initialDraftFiles?: File[];
    onDraftInputChange?: (input: string) => void;
    onDraftModeChange?: (mode: "educational" | "advisory" | "unhinged") => void;
    onDraftFilesChange?: (files: File[]) => void;
  }) => (
    <div>
      <div data-testid="conversation-id">{conversationId}</div>
      <div data-testid="draft-input">{initialDraftInput ?? ""}</div>
      <div data-testid="draft-mode">{initialDraftMode ?? ""}</div>
      <div data-testid="draft-files-count">
        {String(initialDraftFiles?.length ?? 0)}
      </div>
      <button onClick={() => onDraftInputChange?.("Keep this unsent")}>
        Set draft input
      </button>
      <button onClick={() => onDraftModeChange?.("educational")}>
        Set draft mode
      </button>
      <button
        onClick={() =>
          onDraftFilesChange?.([
            new File(["draft"], "draft.pdf", { type: "application/pdf" }),
          ])
        }
      >
        Set draft files
      </button>
    </div>
  ),
}));

function Harness({
  showPanel = true,
  showExpandButton = false,
}: {
  showPanel?: boolean;
  showExpandButton?: boolean;
}) {
  return (
    <AIChatProvider>
      {showPanel ? (
        <AIChatPanel isAIEnabled showExpandButton={showExpandButton} />
      ) : null}
    </AIChatProvider>
  );
}

describe("AIChatPanel continuity", () => {
  beforeEach(() => {
    hoistedMocks.pathname = "/dashboard/assets";
    hoistedMocks.searchParams = "page=1";
    hoistedMocks.uuidValues = [
      "generated-conversation-1",
      "generated-conversation-2",
      "generated-conversation-3",
    ];
    hoistedMocks.fetchConversations.mockClear();
    hoistedMocks.fetchConversationMessages.mockClear();
  });

  it("keeps active conversation and draft state across remounts", async () => {
    const { rerender } = render(<Harness showPanel />);

    fireEvent.click(
      screen.getByRole("button", { name: "Select conversation A" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("conversation-id").textContent).toBe(
        "conversation-a",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Set draft input" }));
    fireEvent.click(screen.getByRole("button", { name: "Set draft mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Set draft files" }));

    rerender(<Harness showPanel={false} />);
    rerender(<Harness showPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("conversation-id").textContent).toBe(
        "conversation-a",
      );
      expect(screen.getByTestId("draft-input").textContent).toBe(
        "Keep this unsent",
      );
      expect(screen.getByTestId("draft-mode").textContent).toBe("educational");
      expect(screen.getByTestId("draft-files-count").textContent).toBe("1");
    });
  });

  it("builds expand links with conversationId and current route as from", async () => {
    hoistedMocks.pathname = "/dashboard/assets";
    hoistedMocks.searchParams = "page=3&type=asset";

    render(<Harness showPanel showExpandButton />);

    await waitFor(() => {
      const expandLink = screen.getByRole("link", { name: "Expand" });
      expect(expandLink.getAttribute("href")).toBe(
        "/dashboard/ai-chat?conversationId=generated-conversation-1&from=%2Fdashboard%2Fassets%3Fpage%3D3%26type%3Dasset",
      );
    });
  });
});
