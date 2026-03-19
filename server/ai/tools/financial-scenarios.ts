"use server";

import { getProjectedSeriesLabel } from "@/lib/planning/scenario/projected-series";
import { runScenario } from "@/lib/planning/scenario/engine";
import { ld, resolveTodayDateKey } from "@/lib/date/date-utils";
import { fetchOrCreateDefaultScenario } from "@/server/financial-scenarios/fetch";
import { fetchProfile } from "@/server/profile/actions";

interface GetFinancialScenariosParams {
  runSimulation: boolean | null;
  simulationYears: number | null;
}

/**
 * Get the user's financial scenario with events and optional simulation.
 * Used by the AI advisor to understand and analyze the user's financial plans.
 */
export async function getFinancialScenarios(
  params: GetFinancialScenariosParams,
) {
  const scenario = await fetchOrCreateDefaultScenario();

  const runSimulation = params.runSimulation ?? true;
  const simulationYears = Math.min(
    Math.max(params.simulationYears ?? 10, 1),
    30,
  );

  // Format events for AI consumption
  const events = scenario.events.map((event) => {
    const conditions = event.unlockedBy.map((c) => {
      const base = { tag: c.tag, type: c.type };

      switch (c.type) {
        case "date-is":
          return {
            ...base,
            date: `${c.value.y}-${String(c.value.m).padStart(2, "0")}`,
          };
        case "date-in-range":
          return {
            ...base,
            start: `${c.value.start.y}-${String(c.value.start.m).padStart(2, "0")}`,
            end: c.value.end
              ? `${c.value.end.y}-${String(c.value.end.m).padStart(2, "0")}`
              : null,
          };
        case "networth-is-above":
          return {
            ...base,
            threshold: c.value.amount,
            thresholdSeries: "net_worth" as const,
          };
        case "cash-is-above":
          return {
            ...base,
            threshold: c.value.amount,
            thresholdSeries: "cash" as const,
          };
        case "event-happened":
          return { ...base, eventName: c.value.eventName };
        case "income-is-above":
          return {
            ...base,
            eventName: c.value.eventName,
            threshold: c.value.amount,
          };
        default:
          return base;
      }
    });

    return {
      name: event.name,
      type: event.type,
      amount: event.amount,
      recurrence: event.recurrence.type,
      conditions,
    };
  });

  const result: {
    scenarioName: string;
    scenarioId: string;
    initialValue: number;
    initialValueBasis: typeof scenario.initialValueBasis;
    projectedSeriesLabel: string;
    eventsCount: number;
    events: typeof events;
    simulation?: {
      years: number;
      startDate: string;
      endDate: string;
      finalProjectedValue: number;
      projectedSeriesByYear: Array<{ year: number; projectedValue: number }>;
    };
  } = {
    scenarioName: scenario.name,
    scenarioId: scenario.id,
    initialValue: scenario.initialValue,
    initialValueBasis: scenario.initialValueBasis,
    projectedSeriesLabel: getProjectedSeriesLabel(scenario.initialValueBasis),
    eventsCount: events.length,
    events,
  };

  // Optionally run the simulation
  if (runSimulation && events.length > 0) {
    const { profile } = await fetchProfile();
    const todayDateKey = resolveTodayDateKey(profile.time_zone);
    const [yearStr, monthStr] = todayDateKey.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const startDate = ld(year, month, 1);
    const endDate = ld(year + simulationYears, month, 1);

    const { projectedSeries: simulatedProjectedSeries } = runScenario({
      scenario,
      startDate,
      endDate,
      initialValue: scenario.initialValue,
      initialValueBasis: scenario.initialValueBasis,
      assumptions: {
        expectedAnnualReturnPercent:
          scenario.assumptions.values.expectedAnnualReturnPercent,
      },
    });

    // Extract year-end projected values for summary.
    const projectedSeriesByYear: Array<{
      year: number;
      projectedValue: number;
    }> = [];
    for (let year = startDate.y; year <= endDate.y; year++) {
      const yearEndKey = `${year}-12`;
      if (simulatedProjectedSeries[yearEndKey] !== undefined) {
        projectedSeriesByYear.push({
          year,
          projectedValue: simulatedProjectedSeries[yearEndKey],
        });
      }
    }

    const projectedSeriesKeys = Object.keys(simulatedProjectedSeries).sort();
    const finalProjectedValue =
      simulatedProjectedSeries[
        projectedSeriesKeys[projectedSeriesKeys.length - 1]
      ] ?? scenario.initialValue;

    result.simulation = {
      years: simulationYears,
      startDate: `${startDate.y}-${String(startDate.m).padStart(2, "0")}`,
      endDate: `${endDate.y}-${String(endDate.m).padStart(2, "0")}`,
      finalProjectedValue,
      projectedSeriesByYear,
    };
  }

  return result;
}
