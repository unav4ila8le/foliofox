import { describe, expect, it } from "vitest";

import type { UIMessage } from "ai";

import { hasSuccessfulWriteToolPart, isWriteToolPartType } from "./write-tools";

function parts(...entries: unknown[]): UIMessage["parts"] {
  return entries as UIMessage["parts"];
}

describe("write tool helpers", () => {
  it("identifies only the write tool part types", () => {
    expect(isWriteToolPartType("tool-createPortfolioRecord")).toBe(true);
    expect(isWriteToolPartType("tool-createPosition")).toBe(true);
    expect(isWriteToolPartType("tool-getPortfolioOverview")).toBe(false);
    expect(isWriteToolPartType("text")).toBe(false);
  });

  it("detects successful writes and ignores failed or read tool outputs", () => {
    expect(
      hasSuccessfulWriteToolPart(
        parts({
          type: "tool-createPosition",
          state: "output-available",
          input: { summary: "Add" },
          output: { success: true },
        }),
      ),
    ).toBe(true);

    expect(
      hasSuccessfulWriteToolPart(
        parts({
          type: "tool-createPosition",
          state: "output-available",
          input: { summary: "Add" },
          output: { success: false, code: "DUPLICATE_NAME" },
        }),
      ),
    ).toBe(false);

    expect(
      hasSuccessfulWriteToolPart(
        parts({
          type: "tool-getPortfolioOverview",
          state: "output-available",
          input: {},
          output: { success: true },
        }),
      ),
    ).toBe(false);

    expect(
      hasSuccessfulWriteToolPart(
        parts({
          type: "tool-createPortfolioRecord",
          state: "output-denied",
          input: { summary: "Buy" },
          approval: { id: "approval-1", approved: false },
        }),
      ),
    ).toBe(false);
  });
});
