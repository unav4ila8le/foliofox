import { describe, expect, it } from "vitest";

import type { UIMessage } from "ai";
import {
  ESTIMATED_CHARS_PER_TOKEN,
  MAX_ESTIMATED_PROMPT_TOKENS,
  MAX_MODEL_CONTEXT_MESSAGES,
} from "@/lib/ai/chat-guardrails-config";
import { buildGuardrailedModelContext } from "@/server/ai/chat-guardrails";

function createMessage(params: {
  id: string;
  role: UIMessage["role"];
  parts: UIMessage["parts"];
}): UIMessage {
  return {
    id: params.id,
    role: params.role,
    parts: params.parts,
  };
}

describe("buildGuardrailedModelContext", () => {
  it("caps model context to the configured max messages", () => {
    const messages: UIMessage[] = Array.from({ length: 60 }, (_, index) =>
      createMessage({
        id: `m-${index}`,
        role: "user",
        parts: [{ type: "text", text: `message-${index}` }],
      }),
    );

    const result = buildGuardrailedModelContext(messages);
    const firstExpectedIndex = messages.length - MAX_MODEL_CONTEXT_MESSAGES;

    expect(result.length).toBe(MAX_MODEL_CONTEXT_MESSAGES);
    expect(result[0]?.id).toBe(`m-${firstExpectedIndex}`);
    expect(result.at(-1)?.id).toBe("m-59");
  });

  it("enforces approximate prompt budget", () => {
    const hugeText = "x".repeat(6000);
    const messages: UIMessage[] = Array.from({ length: 12 }, (_, index) =>
      createMessage({
        id: `huge-${index}`,
        role: "user",
        parts: [{ type: "text", text: `${hugeText}-${index}` }],
      }),
    );

    const result = buildGuardrailedModelContext(messages);

    expect(result.length).toBeLessThan(12);
  });

  it("always keeps the latest user message even if it exceeds budget", () => {
    const overBudgetText = "x".repeat(
      MAX_ESTIMATED_PROMPT_TOKENS * ESTIMATED_CHARS_PER_TOKEN + 50,
    );
    const messages: UIMessage[] = [
      createMessage({
        id: "assistant-old",
        role: "assistant",
        parts: [{ type: "text", text: "old context" }],
      }),
      createMessage({
        id: "user-latest",
        role: "user",
        parts: [{ type: "text", text: overBudgetText }],
      }),
    ];

    const result = buildGuardrailedModelContext(messages);

    expect(result.some((message) => message.id === "user-latest")).toBe(true);
  });

  it("handles assistant-only histories without dropping the latest message", () => {
    const overBudgetText = "x".repeat(
      MAX_ESTIMATED_PROMPT_TOKENS * ESTIMATED_CHARS_PER_TOKEN + 50,
    );
    const messages: UIMessage[] = [
      createMessage({
        id: "assistant-old",
        role: "assistant",
        parts: [{ type: "text", text: "older assistant context" }],
      }),
      createMessage({
        id: "assistant-latest",
        role: "assistant",
        parts: [{ type: "text", text: overBudgetText }],
      }),
    ];

    const result = buildGuardrailedModelContext(messages);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("assistant-latest");
  });

  it("prunes heavy parts from older assistant messages", () => {
    const messages: UIMessage[] = [
      createMessage({
        id: "assistant-heavy-old",
        role: "assistant",
        parts: [
          { type: "text", text: "keep this text" },
          { type: "reasoning", text: "drop reasoning" },
          {
            type: "tool-getPortfolioOverview",
            toolCallId: "tool-1",
            state: "output-available",
            input: {},
            output: { value: "drop tool output" },
          } as unknown as UIMessage["parts"][number],
        ],
      }),
      createMessage({
        id: "assistant-tool-only-old",
        role: "assistant",
        parts: [
          {
            type: "tool-getPortfolioOverview",
            toolCallId: "tool-2",
            state: "output-available",
            input: {},
            output: { value: "tool only" },
          } as unknown as UIMessage["parts"][number],
        ],
      }),
      ...Array.from({ length: 10 }, (_, index) =>
        createMessage({
          id: `tail-${index}`,
          role: "user",
          parts: [{ type: "text", text: `tail-${index}` }],
        }),
      ),
    ];

    const result = buildGuardrailedModelContext(messages);
    const heavyOldMessage = result.find(
      (message) => message.id === "assistant-heavy-old",
    );
    const toolOnlyOldMessage = result.find(
      (message) => message.id === "assistant-tool-only-old",
    );

    expect(heavyOldMessage).toBeDefined();
    expect(heavyOldMessage?.parts).toHaveLength(1);
    expect(heavyOldMessage?.parts[0]?.type).toBe("text");
    expect(toolOnlyOldMessage).toBeUndefined();
  });

  it("drops file parts from historical turns but keeps latest user file parts", () => {
    const messages: UIMessage[] = [
      createMessage({
        id: "user-old-file",
        role: "user",
        parts: [
          { type: "text", text: "older user turn" },
          {
            type: "file",
            filename: "old.pdf",
            mediaType: "application/pdf",
            url: "data:application/pdf;base64,b2xk",
          } as unknown as UIMessage["parts"][number],
        ],
      }),
      createMessage({
        id: "user-latest-file",
        role: "user",
        parts: [
          { type: "text", text: "latest user turn" },
          {
            type: "file",
            filename: "latest.pdf",
            mediaType: "application/pdf",
            url: "data:application/pdf;base64,bGF0ZXN0",
          } as unknown as UIMessage["parts"][number],
        ],
      }),
    ];

    const result = buildGuardrailedModelContext(messages);
    const oldUserMessage = result.find(
      (message) => message.id === "user-old-file",
    );
    const latestUserMessage = result.find(
      (message) => message.id === "user-latest-file",
    );

    expect(oldUserMessage).toBeDefined();
    expect(oldUserMessage?.parts.some((part) => part.type === "file")).toBe(
      false,
    );
    expect(latestUserMessage?.parts.some((part) => part.type === "file")).toBe(
      true,
    );
  });
});
