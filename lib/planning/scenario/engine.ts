import {
  LocalDate,
  isAfterLD,
  addMonthsLD,
  startOfMonthLD,
  toKeyMonth,
  ld,
  isWithinIntervalLD,
} from "@/lib/date/date-utils";
import {
  CashflowConditions,
  ScenarioEventCondition,
  ScenarioEvent,
} from "./helpers";
import type { ScenarioInitialValueBasis } from "@/lib/planning/initial-value-basis";
import {
  isProjectedSeriesThresholdCondition,
  isProjectedSeriesThresholdConditionCompatibleWithBasis,
} from "./projected-series";

type Scenario = {
  name: string;
  events: Array<ScenarioEvent>;
};

type DeterministicScenarioAssumptions = {
  expectedAnnualReturnPercent?: number | null;
};

const makeScenario = (input: {
  name: string;
  events: Array<ScenarioEvent>;
}): Scenario => input;

type FiredEventInfo = {
  firstFiredMonth: string;
  lastFiredMonth: string;
  totalFireCount: number;
};

type EvaluationState = {
  cashflow: Record<string, CashflowEntry>;
  projectedSeries: Record<string, number>;
  currentProjectedValue: number;
  firedEvents: Map<string, FiredEventInfo>;
};

type MonthEvaluationContext = {
  month: LocalDate;
  monthKey: string;
  currentProjectedValue: number;
  initialValueBasis: ScenarioInitialValueBasis;
  firedEvents: Map<string, FiredEventInfo>;
  monthlyEvents: ScenarioEvent[];
};

const isSameMonthLD = (a: LocalDate, b: LocalDate): boolean =>
  a.y === b.y && a.m === b.m;

const evaluateCondition = (
  condition: ScenarioEventCondition,
  context: MonthEvaluationContext,
): boolean => {
  if (
    condition.tag === "projected-series" &&
    isProjectedSeriesThresholdCondition(condition) &&
    !isProjectedSeriesThresholdConditionCompatibleWithBasis(
      condition,
      context.initialValueBasis,
    )
  ) {
    return false;
  }

  switch (condition.type) {
    case "date-is":
      return isSameMonthLD(context.month, condition.value);

    case "date-in-range": {
      const start = startOfMonthLD(condition.value.start);
      const end = condition.value.end
        ? startOfMonthLD(condition.value.end)
        : ld(2999, 12, 1);
      return isWithinIntervalLD(context.month, { start, end });
    }

    case "networth-is-above":
    case "cash-is-above":
      return context.currentProjectedValue > condition.value.amount;

    case "event-happened":
      return context.firedEvents.has(condition.value.eventName);

    case "income-is-above": {
      const incomeEvent = context.monthlyEvents.find(
        (e) => e.name === condition.value.eventName && e.type === "income",
      );
      return incomeEvent ? incomeEvent.amount >= condition.value.amount : false;
    }
  }
};

const canFireThisMonth = (
  event: ScenarioEvent,
  context: MonthEvaluationContext,
): boolean => {
  const firedInfo = context.firedEvents.get(event.name);

  switch (event.recurrence.type) {
    case "once":
      return !firedInfo;

    case "monthly":
      return true;

    case "yearly": {
      const dateRangeCond = event.unlockedBy.find(
        (c): c is Extract<CashflowConditions, { type: "date-in-range" }> =>
          c.tag === "cashflow" && c.type === "date-in-range",
      );

      if (!dateRangeCond) {
        return false;
      }

      const startMonth = dateRangeCond.value.start.m;

      if (!firedInfo) {
        return context.month.m === startMonth;
      }

      const [lastYearStr] = firedInfo.lastFiredMonth.split("-");
      const lastFiredYear = parseInt(lastYearStr);
      const isDifferentYear = lastFiredYear !== context.month.y;

      return isDifferentYear && context.month.m === startMonth;
    }
  }
};

const shouldEventFire = (
  event: ScenarioEvent,
  context: MonthEvaluationContext,
): boolean => {
  if (!canFireThisMonth(event, context)) {
    return false;
  }

  for (const condition of event.unlockedBy) {
    if (!evaluateCondition(condition, context)) {
      return false;
    }
  }

  return true;
};

const toMonthlyGrowthRate = (
  expectedAnnualReturnPercent?: number | null,
): number => {
  if (
    expectedAnnualReturnPercent == null ||
    !Number.isFinite(expectedAnnualReturnPercent)
  ) {
    return 0;
  }

  const annualDecimal = expectedAnnualReturnPercent / 100;
  if (annualDecimal <= -1) {
    // Guard invalid values below -100% and the -100% boundary as total capital loss.
    return -1;
  }

  return Math.pow(1 + annualDecimal, 1 / 12) - 1;
};

const evaluateScenario = (input: {
  scenario: Scenario;
  startDate: LocalDate;
  endDate: LocalDate;
  initialValue: number;
  initialValueBasis: ScenarioInitialValueBasis;
  assumptions?: DeterministicScenarioAssumptions;
}): EvaluationState => {
  const {
    scenario,
    startDate,
    endDate,
    initialValue,
    initialValueBasis,
    assumptions,
  } = input;
  const monthlyGrowthRate = toMonthlyGrowthRate(
    assumptions?.expectedAnnualReturnPercent,
  );

  const state: EvaluationState = {
    cashflow: {},
    projectedSeries: {},
    currentProjectedValue: initialValue,
    firedEvents: new Map(),
  };

  let currentMonth = startOfMonthLD(startDate);
  const finalMonth = startOfMonthLD(endDate);

  while (!isAfterLD(currentMonth, finalMonth)) {
    const monthKey = toKeyMonth(currentMonth);

    state.cashflow[monthKey] = { amount: 0, events: [] };

    // Apply deterministic return to opening projected value for the month.
    // This is not modeled as cashflow, so event-only cashflow remains clean.
    if (monthlyGrowthRate !== 0 && state.currentProjectedValue !== 0) {
      state.currentProjectedValue +=
        state.currentProjectedValue * monthlyGrowthRate;
    }

    const context: MonthEvaluationContext = {
      month: currentMonth,
      monthKey,
      currentProjectedValue: state.currentProjectedValue,
      initialValueBasis,
      firedEvents: state.firedEvents,
      monthlyEvents: [],
    };

    // Separate events into those with only time-based conditions and those with
    // projected-series or event-trigger conditions.
    const eventsWithoutTriggerConditions = scenario.events.filter(
      (event) =>
        !event.unlockedBy.some((condition) => condition.tag !== "cashflow"),
    );
    const eventsWithTriggerConditions = scenario.events.filter((event) =>
      event.unlockedBy.some((condition) => condition.tag !== "cashflow"),
    );

    // First pass: process events without projected-series or event triggers.
    for (const event of eventsWithoutTriggerConditions) {
      if (shouldEventFire(event, context)) {
        const impact = event.type === "income" ? event.amount : -event.amount;

        state.cashflow[monthKey].amount += impact;
        state.cashflow[monthKey].events.push(event);
        state.currentProjectedValue += impact;

        const firedInfo = state.firedEvents.get(event.name);
        if (!firedInfo) {
          state.firedEvents.set(event.name, {
            firstFiredMonth: monthKey,
            lastFiredMonth: monthKey,
            totalFireCount: 1,
          });
        } else {
          firedInfo.lastFiredMonth = monthKey;
          firedInfo.totalFireCount += 1;
        }

        context.monthlyEvents.push(event);
      }
    }

    // Update context projected value for second pass.
    context.currentProjectedValue = state.currentProjectedValue;

    // Second pass: process events with projected-series or event triggers.
    for (const event of eventsWithTriggerConditions) {
      if (shouldEventFire(event, context)) {
        const impact = event.type === "income" ? event.amount : -event.amount;

        state.cashflow[monthKey].amount += impact;
        state.cashflow[monthKey].events.push(event);
        state.currentProjectedValue += impact;

        const firedInfo = state.firedEvents.get(event.name);
        if (!firedInfo) {
          state.firedEvents.set(event.name, {
            firstFiredMonth: monthKey,
            lastFiredMonth: monthKey,
            totalFireCount: 1,
          });
        } else {
          firedInfo.lastFiredMonth = monthKey;
          firedInfo.totalFireCount += 1;
        }

        context.monthlyEvents.push(event);
        context.currentProjectedValue = state.currentProjectedValue;
      }
    }

    state.projectedSeries[monthKey] = state.currentProjectedValue;
    currentMonth = addMonthsLD(currentMonth, 1);
  }

  return state;
};

type CashflowEntry = {
  amount: number;
  events: ScenarioEvent[];
};

type Cashflow = Record<string, CashflowEntry>;

const runScenario = (input: {
  scenario: Scenario;
  startDate: LocalDate;
  endDate: LocalDate;
  initialValue: number;
  initialValueBasis: ScenarioInitialValueBasis;
  assumptions?: DeterministicScenarioAssumptions;
}) => {
  const state = evaluateScenario(input);

  return {
    cashflow: state.cashflow,
    projectedSeries: state.projectedSeries,
  };
};

const makeOneOff = (input: {
  type: "income" | "expense";
  name: string;
  amount: number;
  date: LocalDate;
  unlockedBy?: ScenarioEventCondition[];
}): ScenarioEvent => {
  return {
    type: input.type,
    amount: input.amount,
    name: input.name,
    recurrence: { type: "once" },
    unlockedBy: (input.unlockedBy ?? []).concat([
      { tag: "cashflow", type: "date-is", value: input.date },
    ]),
  };
};

const makeEvent = (input: {
  type: "income" | "expense";
  name: string;
  amount: number;
  unlockedBy: ScenarioEventCondition[];
}): ScenarioEvent => {
  return {
    type: input.type,
    amount: input.amount,
    name: input.name,
    recurrence: { type: "once" },
    unlockedBy: input.unlockedBy,
  };
};

const makeRecurring = (input: {
  type: "income" | "expense";
  name: string;
  amount: number;
  startDate: LocalDate;
  endDate: LocalDate | null;
  frequency: "monthly" | "yearly";
  unlockedBy?: ScenarioEventCondition[];
}): ScenarioEvent => {
  return {
    type: input.type,
    amount: input.amount,
    name: input.name,
    recurrence: { type: input.frequency },
    unlockedBy: (input.unlockedBy ?? []).concat([
      {
        tag: "cashflow",
        type: "date-in-range",
        value: { start: input.startDate, end: input.endDate },
      },
    ]),
  };
};

export {
  type Scenario,
  type ScenarioEvent,
  type DeterministicScenarioAssumptions,
  type Cashflow,
  type CashflowEntry,
  makeScenario,
  runScenario,
  makeOneOff,
  makeRecurring,
  makeEvent,
};
