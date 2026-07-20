import { isStaticToolUIPart, type UIMessage } from "ai";

// Single source of truth for the approval-gated AI write tools: the chat
// route (fail-closed gating), chat UI (confirmation card, dashboard refresh),
// and telemetry (committed outcome) all derive their checks from this list.
export const AI_WRITE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "createPortfolioRecord",
  "createPosition",
]);

const WRITE_TOOL_PART_TYPES: ReadonlySet<string> = new Set(
  [...AI_WRITE_TOOL_NAMES].map((toolName) => `tool-${toolName}`),
);

export function isWriteToolPartType(partType: string): boolean {
  return WRITE_TOOL_PART_TYPES.has(partType);
}

/**
 * True when the parts contain a write tool that executed successfully,
 * meaning portfolio data changed (dashboard RSC is stale, telemetry outcome
 * is "committed").
 */
export function hasSuccessfulWriteToolPart(parts: UIMessage["parts"]): boolean {
  if (!Array.isArray(parts)) {
    return false;
  }

  return parts.some((part) => {
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
