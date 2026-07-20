import { isStaticToolUIPart, type ChatStatus, type UIMessage } from "ai";

import type { MessageFilePart, MessageSourcePart } from "./types";

// Approval-gated write tools rendered with a Confirmation card.
const WRITE_TOOL_PART_TYPES = new Set([
  "tool-createPortfolioRecord",
  "tool-createPosition",
]);

export function isWriteToolPartType(partType: string): boolean {
  return WRITE_TOOL_PART_TYPES.has(partType);
}

/**
 * A pending approval blocks new sends: an unanswered approval request would
 * leave a dangling tool call and break the next model request.
 * "approval-responded" is still pending — the SDK flips the part state
 * synchronously but schedules the auto-resend async, so until the request
 * actually starts the turn is not resolved yet. If that continuation request
 * errors the part stays "approval-responded" forever, so stop blocking on
 * chat error to keep regenerate/submit available as recovery (a resend still
 * carries the approval response, so the approved write is not lost).
 */
export function hasPendingApprovalRequest(
  messages: UIMessage[],
  status: ChatStatus,
): boolean {
  const lastMessage = messages.at(-1);
  if (lastMessage?.role !== "assistant") {
    return false;
  }

  return lastMessage.parts.some(
    (part) =>
      isStaticToolUIPart(part) &&
      (part.state === "approval-requested" ||
        (part.state === "approval-responded" && status !== "error")),
  );
}

/**
 * True when the message contains a write tool that executed successfully,
 * meaning dashboard data (RSC) is stale and should be refreshed.
 */
export function messageHasSuccessfulWrite(message: UIMessage): boolean {
  return message.parts.some((part) => {
    if (!isStaticToolUIPart(part)) {
      return false;
    }
    if (!isWriteToolPartType(part.type)) {
      return false;
    }
    if (part.state !== "output-available") {
      return false;
    }

    const output = part.output as { success?: unknown } | null | undefined;
    return output != null && output.success === true;
  });
}

/**
 * Generate a v4 UUID in the browser.
 *
 * crypto.randomUUID is secure-context-only (HTTPS or localhost), so it is
 * undefined when the app is opened over plain HTTP via a LAN IP — e.g. the
 * local Docker setup (see PR #77). crypto.getRandomValues has no such
 * restriction, so fall back to building the UUID from it.
 */
export function generateUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getSourceLabel(url: string, title?: string) {
  if (title?.trim()) {
    return title;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function isMessageFilePart(
  part: UIMessage["parts"][number],
): part is MessageFilePart {
  return part.type === "file";
}

export function isMessageSourcePart(
  part: UIMessage["parts"][number],
): part is MessageSourcePart {
  return part.type === "source-url" || part.type === "source-document";
}
