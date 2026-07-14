import type { UIMessage } from "ai";

import type { MessageFilePart, MessageSourcePart } from "./types";

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
