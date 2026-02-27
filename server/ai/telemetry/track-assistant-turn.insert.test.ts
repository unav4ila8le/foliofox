import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UIMessage } from "ai";

const insertMock = vi.fn();
const fromMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

describe("trackAssistantTurn insert behavior", () => {
  beforeEach(() => {
    insertMock.mockReset();
    fromMock.mockReset();
    getUserMock.mockReset();

    insertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert: insertMock });
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("skips insert when assistant_message_id is not a UUID", async () => {
    const { trackAssistantTurn } =
      await import("@/server/ai/telemetry/track-assistant-turn");

    await trackAssistantTurn({
      conversationId: "d9ef7f5c-9077-4703-8164-802e44f278a1",
      assistantMessageId: "assistant-1",
      model: "gpt-5-mini",
      promptSource: "typed",
      message: {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "hello" }],
      } as unknown as UIMessage,
      finishReason: "stop",
    });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("skips insert when conversation_id is not a UUID", async () => {
    const { trackAssistantTurn } =
      await import("@/server/ai/telemetry/track-assistant-turn");

    await trackAssistantTurn({
      conversationId: "not-a-uuid",
      assistantMessageId: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
      model: "gpt-5-mini",
      promptSource: "typed",
      message: {
        id: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
        role: "assistant",
        parts: [{ type: "text", text: "hello" }],
      } as unknown as UIMessage,
      finishReason: "stop",
    });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts telemetry when IDs are valid UUIDs", async () => {
    const { trackAssistantTurn } =
      await import("@/server/ai/telemetry/track-assistant-turn");

    await trackAssistantTurn({
      conversationId: "d9ef7f5c-9077-4703-8164-802e44f278a1",
      assistantMessageId: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
      model: "gpt-5-mini",
      promptSource: "typed",
      message: {
        id: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
        role: "assistant",
        parts: [{ type: "text", text: "hello" }],
      } as unknown as UIMessage,
      finishReason: "stop",
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "d9ef7f5c-9077-4703-8164-802e44f278a1",
        assistant_message_id: "c18d1bdf-32ef-4f5a-9c37-d44229f1e7ea",
      }),
    );
  });
});
