import type { UIMessage } from "ai";

import type {
  GroupedMessagePart,
  MessageFilePart,
  MessageSourcePart,
} from "./types";

export function groupAdjacentParts(parts: UIMessage["parts"]) {
  const groups: GroupedMessagePart[] = [];

  parts.forEach((part, index) => {
    if (part.type === "reasoning") {
      const previousGroup = groups.at(-1);
      if (previousGroup?.kind === "reasoning") {
        previousGroup.texts.push(part.text);
        previousGroup.lastIndex = index;
      } else {
        groups.push({
          kind: "reasoning",
          texts: [part.text],
          lastIndex: index,
        });
      }
      return;
    }

    groups.push({ kind: "other", part, index });
  });

  return groups;
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
