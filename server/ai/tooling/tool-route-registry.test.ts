import { describe, expect, it } from "vitest";

import { aiTools } from "@/server/ai/tools";
import { AI_TOOL_ROUTE_REGISTRY } from "@/server/ai/tooling/tool-route-registry";

describe("AI_TOOL_ROUTE_REGISTRY", () => {
  it("declares route tags for every registered tool", () => {
    const toolNames = Object.keys(aiTools).sort();
    const registryNames = Object.keys(AI_TOOL_ROUTE_REGISTRY).sort();

    expect(registryNames).toEqual(toolNames);
  });

  it("does not allow empty route tags", () => {
    for (const routes of Object.values(AI_TOOL_ROUTE_REGISTRY)) {
      expect(routes.length).toBeGreaterThan(0);
    }
  });

  it("keeps known chart/identifier mappings", () => {
    expect(AI_TOOL_ROUTE_REGISTRY.getHistoricalQuotes).toEqual(["chart"]);
    expect(AI_TOOL_ROUTE_REGISTRY.getHistoricalQuotesBatch).toEqual(["chart"]);
    expect(AI_TOOL_ROUTE_REGISTRY.searchSymbols).toEqual(["identifier"]);
  });
});
