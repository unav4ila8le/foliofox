import { describe, expect, test } from "vitest";

import {
  fromDatabaseScenarioSettings,
  getDefaultScenarioAssumptions,
  withScenarioAssumptions,
  withScenarioBaselineMetadata,
} from "./settings";

describe("scenario planning settings", () => {
  test("falls back to defaults when assumptions payload is invalid", () => {
    const settings = fromDatabaseScenarioSettings({
      assumptions: {
        preset: "not-a-preset",
        values: {
          expectedAnnualReturnPercent: 7,
          inflationAnnualPercent: 2.5,
          volatilityAnnualPercent: 15,
        },
      },
    });

    expect(settings.assumptions).toEqual(getDefaultScenarioAssumptions());
  });

  test("keeps valid baseline metadata and drops malformed baseline payload", () => {
    const validSettings = fromDatabaseScenarioSettings({
      assumptions: getDefaultScenarioAssumptions(),
      baseline: {
        sourceCurrency: "USD",
        sourceMode: "net_worth",
        sourceAsOfDateKey: "2026-03-04",
      },
    });

    expect(validSettings.baseline).toEqual({
      sourceCurrency: "USD",
      sourceMode: "net_worth",
      sourceAsOfDateKey: "2026-03-04",
    });

    const malformedSettings = fromDatabaseScenarioSettings({
      assumptions: getDefaultScenarioAssumptions(),
      baseline: {
        sourceCurrency: "USD",
        sourceMode: "manual",
        sourceAsOfDateKey: "03-04-2026",
      },
    });

    expect(malformedSettings.baseline).toBeUndefined();
  });

  test("merges assumptions updates while preserving unknown settings keys", () => {
    const assumptions = {
      preset: "negative" as const,
      values: {
        expectedAnnualReturnPercent: 1.5,
        inflationAnnualPercent: 4,
        volatilityAnnualPercent: 22,
      },
    };

    const merged = withScenarioAssumptions({
      settings: {
        customFlag: true,
        baseline: {
          sourceCurrency: "EUR",
          sourceMode: "cash",
          sourceAsOfDateKey: "2026-03-03",
        },
      },
      assumptions,
    });

    expect(merged).toEqual({
      customFlag: true,
      baseline: {
        sourceCurrency: "EUR",
        sourceMode: "cash",
        sourceAsOfDateKey: "2026-03-03",
      },
      assumptions,
    });
  });

  test("writes baseline metadata and supports clearing it for manual mode", () => {
    const withBaseline = withScenarioBaselineMetadata({
      settings: {
        assumptions: getDefaultScenarioAssumptions(),
        customFlag: "keep",
      },
      baseline: {
        sourceCurrency: "USD",
        sourceMode: "net_worth",
        sourceAsOfDateKey: "2026-03-04",
      },
    });

    expect(withBaseline).toEqual({
      assumptions: getDefaultScenarioAssumptions(),
      customFlag: "keep",
      baseline: {
        sourceCurrency: "USD",
        sourceMode: "net_worth",
        sourceAsOfDateKey: "2026-03-04",
      },
    });

    const withoutBaseline = withScenarioBaselineMetadata({
      settings: withBaseline,
      baseline: undefined,
    });

    expect(withoutBaseline).toEqual({
      assumptions: getDefaultScenarioAssumptions(),
      customFlag: "keep",
    });
  });
});
