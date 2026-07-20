import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UIMessage } from "ai";

const upsertMock = vi.fn();
const fromMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

describe("trackAssistantTurn upsert behavior", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    fromMock.mockReset();
    getUserMock.mockReset();

    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertMock });
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("skips upsert when assistant_message_id is not a UUID", async () => {
    const { trackAssistantTurn } =
      await import("@/server/ai/telemetry/track-assistant-turn");

    await trackAssistantTurn({
      conversationId: "d9ef7f5c-9077-4703-8164-802e44f278a1",
      assistantMessageId: "assistant-1",
      model: "gpt-5.4-mini",
      promptSource: "typed",
      message: {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "hello" }],
      } as unknown as UIMessage,
      finishReason: "stop",
    });

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("skips upsert when conversation_id is not a UUID", async () => {
    const { trackAssistantTurn } =
      await import("@/server/ai/telemetry/track-assistant-turn");

    await trackAssistantTurn({
      conversationId: "not-a-uuid",
      assistantMessageId: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
      model: "gpt-5.4-mini",
      promptSource: "typed",
      message: {
        id: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
        role: "assistant",
        parts: [{ type: "text", text: "hello" }],
      } as unknown as UIMessage,
      finishReason: "stop",
    });

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("upserts telemetry keyed on assistant_message_id when IDs are valid UUIDs", async () => {
    const { trackAssistantTurn } =
      await import("@/server/ai/telemetry/track-assistant-turn");

    await trackAssistantTurn({
      conversationId: "d9ef7f5c-9077-4703-8164-802e44f278a1",
      assistantMessageId: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
      model: "gpt-5.4-mini",
      promptSource: "typed",
      message: {
        id: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
        role: "assistant",
        parts: [{ type: "text", text: "hello" }],
      } as unknown as UIMessage,
      finishReason: "stop",
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "d9ef7f5c-9077-4703-8164-802e44f278a1",
        assistant_message_id: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
        routes: ["general"],
      }),
      // Tool-approval continuations re-report the same assistant message.
      { onConflict: "assistant_message_id" },
    );
  });
});
