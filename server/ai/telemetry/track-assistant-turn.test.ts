import { describe, expect, it } from "vitest";

import {
  getAssistantTextCharCount,
  resolveAssistantOutcome,
  resolveAssistantRoutes,
} from "@/server/ai/telemetry/track-assistant-turn";

type AssistantParts = Parameters<typeof resolveAssistantRoutes>[0];

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
    const routes = resolveAssistantRoutes([
      { type: "tool-getHistoricalQuotes", state: "output-available" },
    ] as unknown as AssistantParts);

    expect(routes).toEqual(["chart"]);
  });

  it("classifies chart route when getHistoricalQuotesBatch tool is used", () => {
    const routes = resolveAssistantRoutes([
      { type: "tool-getHistoricalQuotesBatch", state: "output-available" },
    ] as unknown as AssistantParts);

    expect(routes).toEqual(["chart"]);
  });

  it("classifies identifier route when searchSymbols tool is used", () => {
    const routes = resolveAssistantRoutes([
      { type: "tool-searchSymbols", state: "output-available" },
    ] as unknown as AssistantParts);

    expect(routes).toEqual(["identifier"]);
  });

  it("returns multiple routes when multiple route-driving tools are used", () => {
    const routes = resolveAssistantRoutes([
      { type: "tool-searchSymbols", state: "output-available" },
      { type: "tool-getHistoricalQuotes", state: "output-available" },
    ] as unknown as AssistantParts);

    expect(routes).toEqual(["identifier", "chart"]);
  });

  it("defaults to general route when no known tool is used", () => {
    const routes = resolveAssistantRoutes([
      { type: "text", text: "general answer" },
    ] as AssistantParts);

    expect(routes).toEqual(["general"]);
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
