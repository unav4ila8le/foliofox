import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ChatHistory } from "@/components/dashboard/ai-chat/history";

const conversations = [
  {
    id: "conversation-1",
    title: "Rebalance plan",
    updatedAt: "2026-02-22T12:00:00.000Z",
  },
];

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );

  Element.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
});

describe("ChatHistory", () => {
  it("opens history and selects a conversation", () => {
    const onSelectConversation = vi.fn();
    const handleDelete = vi.fn();

    render(
      <ChatHistory
        isAIEnabled
        conversations={conversations}
        onSelectConversation={onSelectConversation}
        handleDelete={handleDelete}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Conversation history" }),
    );

    fireEvent.click(screen.getByText("Rebalance plan"));

    expect(onSelectConversation).toHaveBeenCalledWith("conversation-1");
  });

  it("deletes a conversation", () => {
    const onSelectConversation = vi.fn();
    const handleDelete = vi.fn();

    render(
      <ChatHistory
        isAIEnabled
        conversations={conversations}
        onSelectConversation={onSelectConversation}
        handleDelete={handleDelete}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Conversation history" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Rebalance plan" }),
    );

    expect(handleDelete).toHaveBeenCalledOnce();
    expect(handleDelete).toHaveBeenCalledWith(
      expect.any(Object),
      "conversation-1",
    );
  });
});
