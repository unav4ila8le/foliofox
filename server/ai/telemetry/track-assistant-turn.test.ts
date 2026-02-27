import { describe, expect, it } from "vitest";

import {
  getAssistantTextCharCount,
  resolveAssistantOutcome,
  resolveAssistantRoute,
} from "@/server/ai/telemetry/track-assistant-turn";

type AssistantParts = Parameters<typeof resolveAssistantRoute>[0];

describe("track-assistant-turn helpers", () => {
  it("counts only assistant text parts", () => {
    const chars = getAssistantTextCharCount([
      { type: "text", text: "hello" },
      { type: "reasoning", text: "ignored" },
      { type: "text", text: " world" },
    ] as AssistantParts);

    expect(chars).toBe(11);
  });

  it("classifies chart route when getHistoricalQuotes tool is used", () => {
    const route = resolveAssistantRoute([
      { type: "tool-getHistoricalQuotes", state: "output-available" },
    ] as unknown as AssistantParts);

    expect(route).toBe("chart");
  });

  it("classifies identifier route when searchSymbols tool is used", () => {
    const route = resolveAssistantRoute([
      { type: "tool-searchSymbols", state: "output-available" },
    ] as unknown as AssistantParts);

    expect(route).toBe("identifier");
  });

  it("defaults to general route when no known tool is used", () => {
    const route = resolveAssistantRoute([
      { type: "text", text: "general answer" },
    ] as AssistantParts);

    expect(route).toBe("general");
  });

  it("returns error outcome on finishReason error", () => {
    const outcome = resolveAssistantOutcome({
      parts: [{ type: "text", text: "failed" }] as AssistantParts,
      finishReason: "error",
    });

    expect(outcome).toBe("error");
  });

  it("returns error outcome when tool output is denied or errored", () => {
    const deniedOutcome = resolveAssistantOutcome({
      parts: [
        { type: "tool-searchSymbols", state: "output-denied" },
      ] as unknown as AssistantParts,
      finishReason: "stop",
    });
    const erroredOutcome = resolveAssistantOutcome({
      parts: [
        { type: "tool-getHistoricalQuotes", state: "output-error" },
      ] as unknown as AssistantParts,
      finishReason: "stop",
    });

    expect(deniedOutcome).toBe("error");
    expect(erroredOutcome).toBe("error");
  });

  it("returns ok outcome when no error conditions are present", () => {
    const outcome = resolveAssistantOutcome({
      parts: [{ type: "text", text: "ok" }] as AssistantParts,
      finishReason: "stop",
    });

    expect(outcome).toBe("ok");
  });
});
