import { describe, expect, it } from "vitest";

import {
  formatCapitalGainsTaxRatePercent,
  normalizeCapitalGainsTaxRateToDecimal,
  parseCapitalGainsTaxRatePercent,
} from "./capital-gains-tax-rate";

describe("capital-gains-tax-rate helpers", () => {
  describe("parseCapitalGainsTaxRatePercent", () => {
    it("returns null for empty input", () => {
      expect(parseCapitalGainsTaxRatePercent("")).toBeNull();
      expect(parseCapitalGainsTaxRatePercent("   ")).toBeNull();
      expect(parseCapitalGainsTaxRatePercent(null)).toBeNull();
      expect(parseCapitalGainsTaxRatePercent(undefined)).toBeNull();
    });

    it("converts percentage input to decimal", () => {
      expect(parseCapitalGainsTaxRatePercent("26")).toBe(0.26);
      expect(parseCapitalGainsTaxRatePercent("12.5")).toBe(0.125);
    });
  });

  describe("formatCapitalGainsTaxRatePercent", () => {
    it("formats decimal values to percent string", () => {
      expect(formatCapitalGainsTaxRatePercent(0.26)).toBe("26");
      expect(formatCapitalGainsTaxRatePercent(0.125)).toBe("12.5");
    });

    it("returns empty string for null/invalid values", () => {
      expect(formatCapitalGainsTaxRatePercent(null)).toBe("");
      expect(formatCapitalGainsTaxRatePercent(undefined)).toBe("");
      expect(formatCapitalGainsTaxRatePercent(Number.NaN)).toBe("");
    });
  });

  describe("normalizeCapitalGainsTaxRateToDecimal", () => {
    it("accepts decimal values directly", () => {
      expect(normalizeCapitalGainsTaxRateToDecimal(0)).toBe(0);
      expect(normalizeCapitalGainsTaxRateToDecimal(0.26)).toBe(0.26);
      expect(normalizeCapitalGainsTaxRateToDecimal(1)).toBe(1);
    });

    it("converts percentage values to decimals", () => {
      expect(normalizeCapitalGainsTaxRateToDecimal(26)).toBe(0.26);
      expect(normalizeCapitalGainsTaxRateToDecimal(12.5)).toBe(0.125);
      expect(normalizeCapitalGainsTaxRateToDecimal(100)).toBe(1);
    });

    it("returns null for empty values", () => {
      expect(normalizeCapitalGainsTaxRateToDecimal(null)).toBeNull();
      expect(normalizeCapitalGainsTaxRateToDecimal(undefined)).toBeNull();
    });

    it("returns NaN for invalid values", () => {
      expect(normalizeCapitalGainsTaxRateToDecimal(-1)).toBeNaN();
      expect(normalizeCapitalGainsTaxRateToDecimal(120)).toBeNaN();
      expect(normalizeCapitalGainsTaxRateToDecimal(Number.NaN)).toBeNaN();
      expect(
        normalizeCapitalGainsTaxRateToDecimal(Number.POSITIVE_INFINITY),
      ).toBeNaN();
    });
  });
});
