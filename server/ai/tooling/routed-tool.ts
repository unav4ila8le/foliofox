import type { Tool } from "ai";

import type { AIAssistantRoute } from "@/server/ai/telemetry/constants";

type TelemetryRoutes = readonly [AIAssistantRoute, ...AIAssistantRoute[]];

export type RoutedTool<INPUT, OUTPUT> = Tool<INPUT, OUTPUT> & {
  telemetryRoutes: TelemetryRoutes;
};

/**
 * Create an AI SDK tool with required telemetry route tags.
 */
export function routedTool<INPUT, OUTPUT>(
  definition: Tool<INPUT, OUTPUT> & { telemetryRoutes: TelemetryRoutes },
): RoutedTool<INPUT, OUTPUT> {
  const { telemetryRoutes, ...toolDefinition } = definition;

  return {
    ...toolDefinition,
    telemetryRoutes,
  } as RoutedTool<INPUT, OUTPUT>;
}
