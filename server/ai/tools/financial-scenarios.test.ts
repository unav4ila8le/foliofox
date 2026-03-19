import { beforeEach, describe, expect, it, vi } from "vitest";

import { getFinancialScenarios } from "@/server/ai/tools/financial-scenarios";
import { ld } from "@/lib/date/date-utils";
import { makeOneOff } from "@/lib/planning/scenario/engine";

const { fetchOrCreateDefaultScenarioMock, fetchProfileMock } = vi.hoisted(
  () => ({
    fetchOrCreateDefaultScenarioMock: vi.fn(),
    fetchProfileMock: vi.fn(),
  }),
);

vi.mock("@/server/financial-scenarios/fetch", () => ({
  fetchOrCreateDefaultScenario: fetchOrCreateDefaultScenarioMock,
}));

vi.mock("@/server/profile/actions", () => ({
  fetchProfile: fetchProfileMock,
}));

describe("getFinancialScenarios", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-19T00:00:00.000Z"));
    fetchOrCreateDefaultScenarioMock.mockReset();
    fetchProfileMock.mockReset();
  });

  it("serializes cash threshold conditions with basis-aware projected series labels", async () => {
    fetchOrCreateDefaultScenarioMock.mockResolvedValue({
      id: "scenario-1",
      name: "Cash runway",
      initialValue: 25000,
      initialValueBasis: "cash",
      assumptions: {
        preset: "average",
        values: {
          expectedAnnualReturnPercent: 7,
          inflationAnnualPercent: 2.5,
          volatilityAnnualPercent: 15,
        },
      },
      events: [
        makeOneOff({
          name: "Car purchase",
          type: "expense",
          amount: 15000,
          date: ld(2027, 3, 10),
          unlockedBy: [
            {
              tag: "projected-series",
              type: "cash-is-above",
              value: { amount: 60000 },
            },
          ],
        }),
      ],
    });
    fetchProfileMock.mockResolvedValue({
      profile: {
        time_zone: "UTC",
      },
    });

    const result = await getFinancialScenarios({
      runSimulation: true,
      simulationYears: 2,
    });

    expect(result.initialValueBasis).toBe("cash");
    expect(result.projectedSeriesLabel).toBe("Cash");
    expect(result.events[0].conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "cash-is-above",
          threshold: 60000,
          thresholdSeries: "cash",
        }),
      ]),
    );
    expect(result.simulation).toEqual(
      expect.objectContaining({
        years: 2,
        startDate: "2026-03",
        endDate: "2028-03",
        finalProjectedValue: expect.any(Number),
        projectedSeriesByYear: expect.any(Array),
      }),
    );
  });

  it("serializes net worth threshold conditions without requiring a simulation run", async () => {
    fetchOrCreateDefaultScenarioMock.mockResolvedValue({
      id: "scenario-2",
      name: "Net worth plan",
      initialValue: 500000,
      initialValueBasis: "net_worth",
      assumptions: {
        preset: "average",
        values: {
          expectedAnnualReturnPercent: 7,
          inflationAnnualPercent: 2.5,
          volatilityAnnualPercent: 15,
        },
      },
      events: [
        makeOneOff({
          name: "House upgrade",
          type: "expense",
          amount: 40000,
          date: ld(2027, 6, 1),
          unlockedBy: [
            {
              tag: "projected-series",
              type: "networth-is-above",
              value: { amount: 750000 },
            },
          ],
        }),
      ],
    });

    const result = await getFinancialScenarios({
      runSimulation: false,
      simulationYears: 5,
    });

    expect(fetchProfileMock).not.toHaveBeenCalled();
    expect(result.initialValueBasis).toBe("net_worth");
    expect(result.projectedSeriesLabel).toBe("Net Worth");
    expect(result.events[0].conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "networth-is-above",
          threshold: 750000,
          thresholdSeries: "net_worth",
        }),
      ]),
    );
    expect(result.simulation).toBeUndefined();
  });
});
