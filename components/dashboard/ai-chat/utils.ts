import type { UIMessage } from "ai";

import type { MessageFilePart, MessageSourcePart } from "./types";

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
