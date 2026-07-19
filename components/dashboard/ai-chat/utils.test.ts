import { afterEach, describe, expect, it, vi } from "vitest";

import type { UIMessage } from "ai";

import {
  generateUuid,
  hasPendingApprovalRequest,
  isWriteToolPartType,
  messageHasSuccessfulWrite,
} from "./utils";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateUuid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
    });

    expect(generateUuid()).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("falls back to getRandomValues in insecure contexts", () => {
    // Simulate a plain-HTTP LAN-IP context: randomUUID missing,
    // getRandomValues still available.
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(
        globalThis.crypto,
      ),
    });

    expect(generateUuid()).toMatch(UUID_V4_PATTERN);
    expect(generateUuid()).not.toBe(generateUuid());
  });
});

function assistantMessage(parts: unknown[]): UIMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    parts,
  } as UIMessage;
}

describe("write tool helpers", () => {
  it("identifies only the write tool part types", () => {
    expect(isWriteToolPartType("tool-createPortfolioRecord")).toBe(true);
    expect(isWriteToolPartType("tool-createPosition")).toBe(true);
    expect(isWriteToolPartType("tool-getPortfolioOverview")).toBe(false);
    expect(isWriteToolPartType("text")).toBe(false);
  });

  it("detects a pending approval on the last assistant message", () => {
    const messages = [
      assistantMessage([
        {
          type: "tool-createPortfolioRecord",
          state: "approval-requested",
          input: { summary: "Buy" },
          approval: { id: "approval-1" },
        },
      ]),
    ];

    expect(hasPendingApprovalRequest(messages)).toBe(true);
  });

  it("still counts approval-responded as pending until the turn resumes", () => {
    // addToolApprovalResponse flips the part synchronously, but the auto
    // resend is async — sends must stay blocked in that gap.
    expect(
      hasPendingApprovalRequest([
        assistantMessage([
          {
            type: "tool-createPortfolioRecord",
            state: "approval-responded",
            input: { summary: "Buy" },
            approval: { id: "approval-1", approved: true },
          },
        ]),
      ]),
    ).toBe(true);
  });

  it("reports no pending approval once resolved or on non-assistant last message", () => {
    expect(
      hasPendingApprovalRequest([
        assistantMessage([
          {
            type: "tool-createPortfolioRecord",
            state: "output-available",
            input: { summary: "Buy" },
            output: { success: true },
            approval: { id: "approval-1", approved: true },
          },
        ]),
      ]),
    ).toBe(false);

    expect(
      hasPendingApprovalRequest([
        assistantMessage([
          {
            type: "tool-createPortfolioRecord",
            state: "output-denied",
            input: { summary: "Buy" },
            approval: { id: "approval-1", approved: false },
          },
        ]),
      ]),
    ).toBe(false);

    expect(
      hasPendingApprovalRequest([
        { id: "user-1", role: "user", parts: [] } as unknown as UIMessage,
      ]),
    ).toBe(false);

    expect(hasPendingApprovalRequest([])).toBe(false);
  });

  it("detects successful writes and ignores failed or read tool outputs", () => {
    expect(
      messageHasSuccessfulWrite(
        assistantMessage([
          {
            type: "tool-createPosition",
            state: "output-available",
            input: { summary: "Add" },
            output: { success: true },
          },
        ]),
      ),
    ).toBe(true);

    expect(
      messageHasSuccessfulWrite(
        assistantMessage([
          {
            type: "tool-createPosition",
            state: "output-available",
            input: { summary: "Add" },
            output: { success: false, code: "DUPLICATE_NAME" },
          },
        ]),
      ),
    ).toBe(false);

    expect(
      messageHasSuccessfulWrite(
        assistantMessage([
          {
            type: "tool-getPortfolioOverview",
            state: "output-available",
            input: {},
            output: { success: true },
          },
        ]),
      ),
    ).toBe(false);

    expect(
      messageHasSuccessfulWrite(
        assistantMessage([
          {
            type: "tool-createPortfolioRecord",
            state: "output-denied",
            input: { summary: "Buy" },
            approval: { id: "approval-1", approved: false },
          },
        ]),
      ),
    ).toBe(false);
  });
});
