import { type UIMessage } from "ai";

import { aiTools } from "@/server/ai/tools";
import {
  AI_ASSISTANT_ROUTE_SORT_ORDER,
  type AIAssistantRoute,
} from "@/server/ai/telemetry/constants";

type AIToolName = keyof typeof aiTools;
type TelemetryRoutes = readonly [AIAssistantRoute, ...AIAssistantRoute[]];

function getTelemetryRoutes(toolName: AIToolName): TelemetryRoutes {
  const routes = aiTools[toolName].telemetryRoutes;

  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error(`Tool "${toolName}" must declare telemetryRoutes.`);
  }

  return routes;
}

export const AI_TOOL_ROUTE_REGISTRY = Object.freeze(
  Object.fromEntries(
    (Object.keys(aiTools) as AIToolName[]).map((toolName) => [
      toolName,
      getTelemetryRoutes(toolName),
    ]),
  ) as Record<AIToolName, TelemetryRoutes>,
);

function parseToolNameFromPartType(partType: string): AIToolName | null {
  if (!partType.startsWith("tool-")) {
    return null;
  }

  const toolName = partType.slice("tool-".length);
  if (!Object.hasOwn(AI_TOOL_ROUTE_REGISTRY, toolName)) {
    return null;
  }

  return toolName as AIToolName;
}

/**
 * Resolve telemetry routes from tool parts used in a single assistant turn.
 */
export function resolveRoutesFromMessageParts(
  parts: UIMessage["parts"],
): AIAssistantRoute[] {
  if (!Array.isArray(parts)) {
    return ["general"];
  }

  const routeSet = new Set<AIAssistantRoute>();

  for (const part of parts) {
    const toolName = parseToolNameFromPartType(part.type);
    if (!toolName) {
      continue;
    }

    for (const route of AI_TOOL_ROUTE_REGISTRY[toolName]) {
      routeSet.add(route);
    }
  }

  if (routeSet.size === 0) {
    return ["general"];
  }

  if (routeSet.size > 1 && routeSet.has("general")) {
    routeSet.delete("general");
  }

  return Array.from(routeSet).sort(
    (left, right) =>
      AI_ASSISTANT_ROUTE_SORT_ORDER[left] -
      AI_ASSISTANT_ROUTE_SORT_ORDER[right],
  );
}
