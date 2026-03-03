import { describe, expect, it } from "vitest";

import { createSystemPrompt } from "@/server/ai/system-prompt";

describe("createSystemPrompt", () => {
  it("uses the injected currentDateKey instead of deriving UTC today internally", () => {
    const prompt = createSystemPrompt({
      mode: "advisory",
      aiTools: {
        getPortfolioOverview: { description: "overview" },
      },
      currentDateKey: "2030-12-31",
    });

    expect(prompt).toContain(
      "Current date: 2030-12-31 (use for relative date calculations and tool inputs).",
    );
  });
});
