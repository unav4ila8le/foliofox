import type { ToolUIPart } from "ai";

const MAX_OUTPUT_PREVIEW_CHARS = 12000;
const MAX_GENERIC_ARRAY_ITEMS_PER_SIDE = 3;
const MAX_GENERIC_OBJECT_KEYS = 24;
const MAX_GENERIC_STRING_LENGTH = 400;

function estimateSerializedLength(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function buildGenericOutputPreview(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length <= MAX_GENERIC_STRING_LENGTH) {
      return value;
    }

    return `${value.slice(0, MAX_GENERIC_STRING_LENGTH)}… [truncated ${value.length - MAX_GENERIC_STRING_LENGTH} chars]`;
  }

  if (value == null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length <= MAX_GENERIC_ARRAY_ITEMS_PER_SIDE * 2) {
      return value.map((item) => buildGenericOutputPreview(item));
    }

    const head = value
      .slice(0, MAX_GENERIC_ARRAY_ITEMS_PER_SIDE)
      .map((item) => buildGenericOutputPreview(item));
    const tail = value
      .slice(-MAX_GENERIC_ARRAY_ITEMS_PER_SIDE)
      .map((item) => buildGenericOutputPreview(item));

    return [
      ...head,
      `[... ${value.length - MAX_GENERIC_ARRAY_ITEMS_PER_SIDE * 2} items omitted from preview ...]`,
      ...tail,
    ];
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const keptEntries = entries.slice(0, MAX_GENERIC_OBJECT_KEYS);
  const preview = Object.fromEntries(
    keptEntries.map(([key, nestedValue]) => [
      key,
      buildGenericOutputPreview(nestedValue),
    ]),
  );

  if (entries.length > MAX_GENERIC_OBJECT_KEYS) {
    preview.__omittedKeys = entries.length - MAX_GENERIC_OBJECT_KEYS;
  }

  return preview;
}

function withSizeGuardPreview(output: unknown): unknown {
  const serializedLength = estimateSerializedLength(output);
  if (serializedLength <= MAX_OUTPUT_PREVIEW_CHARS) {
    return output;
  }

  return {
    truncated: true,
    originalSizeChars: serializedLength,
    previewNotice:
      "Large tool output was condensed for faster rendering in chat UI.",
    preview: buildGenericOutputPreview(output),
  };
}

/**
 * Reduce heavy tool payloads for UI rendering while keeping useful context.
 */
export function getToolOutputPreview(
  part: Pick<ToolUIPart, "type" | "output">,
): unknown {
  return withSizeGuardPreview(part.output);
}
