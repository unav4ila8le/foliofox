import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ChatHeader } from "@/components/dashboard/ai-chat/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MAX_CONVERSATIONS_PER_USER } from "@/lib/ai/chat-guardrails-config";

vi.mock("@/server/ai/conversations/delete", () => ({
  deleteConversation: vi.fn(),
}));

describe("ChatHeader", () => {
  it("disables new conversation button when user is at cap", () => {
    render(
      <TooltipProvider>
        <ChatHeader
          conversations={[]}
          onSelectConversation={() => {}}
          onNewConversation={() => {}}
          isAIEnabled
          isAtConversationCap
          maxConversations={MAX_CONVERSATIONS_PER_USER}
          totalConversations={MAX_CONVERSATIONS_PER_USER}
        />
      </TooltipProvider>,
    );

    const newConversationButton = screen.getByRole("button", {
      name: "New conversation",
    }) as HTMLButtonElement;

    expect(newConversationButton.disabled).toBe(true);
  });

  it("renders the expand link when href is provided", () => {
    render(
      <TooltipProvider>
        <ChatHeader
          conversations={[]}
          onSelectConversation={() => {}}
          onNewConversation={() => {}}
          isAIEnabled
          expandHref="/dashboard/ai-chat?conversationId=conversation-1&from=%2Fdashboard%2Fassets"
        />
      </TooltipProvider>,
    );

    const expandLink = screen.getByRole("link", { name: "Expand" });
    expect(expandLink.getAttribute("href")).toBe(
      "/dashboard/ai-chat?conversationId=conversation-1&from=%2Fdashboard%2Fassets",
    );
  });
});
