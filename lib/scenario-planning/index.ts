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
  BalanceConditions,
  CashflowConditions,
  ScenarioEvent,
} from "./helpers";

type Scenario = {
  name: string;
  events: Array<ScenarioEvent>;
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
  balance: Record<string, number>;
  currentBalance: number;
  firedEvents: Map<string, FiredEventInfo>;
};

type MonthEvaluationContext = {
  month: LocalDate;
  monthKey: string;
  currentBalance: number;
  firedEvents: Map<string, FiredEventInfo>;
  monthlyEvents: ScenarioEvent[];
};

const isSameMonthLD = (a: LocalDate, b: LocalDate): boolean =>
  a.y === b.y && a.m === b.m;

const evaluateCondition = (
  condition: CashflowConditions | BalanceConditions,
  context: MonthEvaluationContext,
): boolean => {
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
      return context.currentBalance > condition.value.amount;

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

const evaluateScenario = (input: {
  scenario: Scenario;
  startDate: LocalDate;
  endDate: LocalDate;
  initialBalance: number;
}): EvaluationState => {
  const { scenario, startDate, endDate, initialBalance } = input;

  const state: EvaluationState = {
    cashflow: {},
    balance: {},
    currentBalance: initialBalance,
    firedEvents: new Map(),
  };

  let currentMonth = startOfMonthLD(startDate);
  const finalMonth = startOfMonthLD(endDate);

  while (!isAfterLD(currentMonth, finalMonth)) {
    const monthKey = toKeyMonth(currentMonth);

    state.cashflow[monthKey] = { amount: 0, events: [] };

    const context: MonthEvaluationContext = {
      month: currentMonth,
      monthKey,
      currentBalance: state.currentBalance,
      firedEvents: state.firedEvents,
      monthlyEvents: [],
    };

    // Separate events into those with and without balance conditions
    const eventsWithoutBalanceConditions = scenario.events.filter(
      (e) => !e.unlockedBy.some((c) => c.tag === "balance"),
    );
    const eventsWithBalanceConditions = scenario.events.filter((e) =>
      e.unlockedBy.some((c) => c.tag === "balance"),
    );

    // First pass: process events without balance conditions
    for (const event of eventsWithoutBalanceConditions) {
      if (shouldEventFire(event, context)) {
        const impact = event.type === "income" ? event.amount : -event.amount;

        state.cashflow[monthKey].amount += impact;
        state.cashflow[monthKey].events.push(event);
        state.currentBalance += impact;

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

    // Update context balance for second pass
    context.currentBalance = state.currentBalance;

    // Second pass: process events with balance conditions
    for (const event of eventsWithBalanceConditions) {
      if (shouldEventFire(event, context)) {
        const impact = event.type === "income" ? event.amount : -event.amount;

        state.cashflow[monthKey].amount += impact;
        state.cashflow[monthKey].events.push(event);
        state.currentBalance += impact;

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
        context.currentBalance = state.currentBalance;
      }
    }

    state.balance[monthKey] = state.currentBalance;
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
  initialBalance: number;
}) => {
  const state = evaluateScenario(input);

  return {
    cashflow: state.cashflow,
    balance: state.balance,
  };
};

const makeOneOff = (input: {
  type: "income" | "expense";
  name: string;
  amount: number;
  date: LocalDate;
  unlockedBy?: Array<CashflowConditions | BalanceConditions>;
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
  unlockedBy: Array<CashflowConditions | BalanceConditions>;
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
  unlockedBy?: Array<CashflowConditions | BalanceConditions>;
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
  type Cashflow,
  type CashflowEntry,
  makeScenario,
  runScenario,
  makeOneOff,
  makeRecurring,
  makeEvent,
};
