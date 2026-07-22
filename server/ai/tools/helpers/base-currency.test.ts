import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { fetchCurrenciesMock } = vi.hoisted(() => ({
  fetchCurrenciesMock: vi.fn(),
}));

vi.mock("@/server/currencies/fetch", () => ({
  fetchCurrencies: fetchCurrenciesMock,
}));

import { normalizeAIBaseCurrency } from "./base-currency";

describe("normalizeAIBaseCurrency", () => {
  beforeEach(() => {
    fetchCurrenciesMock.mockReset();
  });

  it.each([null, "", "   "])("normalizes %j to null", async (value) => {
    await expect(normalizeAIBaseCurrency(value)).resolves.toBeNull();
    expect(fetchCurrenciesMock).not.toHaveBeenCalled();
  });

  it("normalizes and accepts a supported currency", async () => {
    fetchCurrenciesMock.mockResolvedValue([
      { alphabetic_code: "USD", name: "US Dollar" },
    ]);

    await expect(normalizeAIBaseCurrency(" usd ")).resolves.toBe("USD");
  });

  it("tells the model to pass null for an unsupported currency", async () => {
    fetchCurrenciesMock.mockResolvedValue([
      { alphabetic_code: "USD", name: "US Dollar" },
    ]);

    await expect(normalizeAIBaseCurrency("xyz")).rejects.toThrow(
      'Unsupported baseCurrency "XYZ". Set baseCurrency to null to use the profile currency.',
    );
  });
});

describe("AI tool baseCurrency schemas", () => {
  it("uses nullable null guidance for all eight analysis tools", async () => {
    const { aiTools } = await import("../index");
    const toolNames = [
      "getPortfolioOverview",
      "getNetWorthHistory",
      "getNetWorthChange",
      "getProjectedIncome",
      "getAssetsPerformance",
      "getTopMovers",
      "getAllocationDrift",
      "getCurrencyExposure",
    ] as const;

    for (const toolName of toolNames) {
      const inputSchema = aiTools[toolName].inputSchema;
      expect(inputSchema).toBeInstanceOf(z.ZodObject);

      if (!(inputSchema instanceof z.ZodObject)) continue;

      const baseCurrency = inputSchema.shape.baseCurrency;
      expect(baseCurrency.safeParse(null).success).toBe(true);
      expect(baseCurrency.description).toContain("Set to null");
      expect(baseCurrency.description).not.toMatch(/leave empty/i);
    }
  });
});
