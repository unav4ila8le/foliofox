"use server";

import { runScenario } from "@/lib/scenario-planning";
import { ld } from "@/lib/date-format";
import { fetchOrCreateDefaultScenario } from "@/server/financial-scenarios/fetch";

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
          return { ...base, threshold: c.value.amount };
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
    initialBalance: number;
    eventsCount: number;
    events: typeof events;
    simulation?: {
      years: number;
      startDate: string;
      endDate: string;
      finalBalance: number;
      balanceByYear: Array<{ year: number; balance: number }>;
    };
  } = {
    scenarioName: scenario.name,
    scenarioId: scenario.id,
    initialBalance: scenario.initialBalance,
    eventsCount: events.length,
    events,
  };

  // Optionally run the simulation
  if (runSimulation && events.length > 0) {
    const today = new Date();
    const startDate = ld(today.getFullYear(), today.getMonth() + 1, 1);
    const endDate = ld(
      today.getFullYear() + simulationYears,
      today.getMonth() + 1,
      1,
    );

    const { balance } = runScenario({
      scenario,
      startDate,
      endDate,
      initialBalance: scenario.initialBalance,
    });

    // Extract year-end balances for summary
    const balanceByYear: Array<{ year: number; balance: number }> = [];
    for (let year = startDate.y; year <= endDate.y; year++) {
      const yearEndKey = `${year}-12`;
      if (balance[yearEndKey] !== undefined) {
        balanceByYear.push({ year, balance: balance[yearEndKey] });
      }
    }

    const balanceKeys = Object.keys(balance).sort();
    const finalBalance =
      balance[balanceKeys[balanceKeys.length - 1]] ?? scenario.initialBalance;

    result.simulation = {
      years: simulationYears,
      startDate: `${startDate.y}-${String(startDate.m).padStart(2, "0")}`,
      endDate: `${endDate.y}-${String(endDate.m).padStart(2, "0")}`,
      finalBalance,
      balanceByYear,
    };
  }

  return result;
}
