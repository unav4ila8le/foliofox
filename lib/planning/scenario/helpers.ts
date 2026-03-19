import { z } from "zod";
import { LocalDate } from "@/lib/date/date-utils";
import type { FinancialScenario } from "@/types/global.types";

//-- Schemas
const CashflowConditions = z.discriminatedUnion("type", [
  z.object({
    tag: z.literal("cashflow"),
    type: z.literal("date-is"),
    value: LocalDate,
  }),
  z.object({
    tag: z.literal("cashflow"),
    type: z.literal("date-in-range"),
    value: z.object({
      start: LocalDate,
      end: LocalDate.nullable(),
    }),
  }),
]);

const ProjectedSeriesConditions = z.discriminatedUnion("type", [
  z.object({
    tag: z.literal("projected-series"),
    type: z.literal("networth-is-above"),
    value: z.object({
      amount: z.number(),
    }),
  }),
  z.object({
    tag: z.literal("projected-series"),
    type: z.literal("cash-is-above"),
    value: z.object({
      amount: z.number(),
    }),
  }),
]);

const EventConditions = z.discriminatedUnion("type", [
  z.object({
    tag: z.literal("event"),
    type: z.literal("event-happened"),
    value: z.object({
      eventName: z.string(),
    }),
  }),
  z.object({
    tag: z.literal("event"),
    type: z.literal("income-is-above"),
    value: z.object({
      eventName: z.string(),
      amount: z.number(),
    }),
  }),
]);

const ScenarioEventCondition = z.discriminatedUnion("tag", [
  CashflowConditions,
  ProjectedSeriesConditions,
  EventConditions,
]);

const ScenarioEvent = z.object({
  name: z.string(),
  type: z.enum(["income", "expense"]),
  amount: z.number(),
  recurrence: z.union([
    z.object({
      type: z.literal("once"),
    }),
    z.object({
      type: z.literal("monthly"),
    }),
    z.object({
      type: z.literal("yearly"),
    }),
  ]),
  unlockedBy: z.array(ScenarioEventCondition),
  metadata: z.record(z.string(), z.string()).optional(),
});

const Scenario = z.object({
  name: z.string(),
  events: z.array(ScenarioEvent),
});

type Scenario = z.infer<typeof Scenario>;
type ScenarioEvent = z.infer<typeof ScenarioEvent>;
type CashflowConditions = z.infer<typeof CashflowConditions>;
type ProjectedSeriesConditions = z.infer<typeof ProjectedSeriesConditions>;
type EventConditions = z.infer<typeof EventConditions>;
type ScenarioEventCondition = z.infer<typeof ScenarioEventCondition>;

const fromDatabaseScenarioToScenario = (
  database: FinancialScenario,
): z.infer<typeof Scenario> => {
  const { name, events } = database;

  return Scenario.parse({
    name,
    events: events ? ScenarioEvent.array().parse(events) : [],
  });
};

export {
  fromDatabaseScenarioToScenario,
  Scenario,
  ScenarioEvent,
  CashflowConditions,
  ProjectedSeriesConditions,
  EventConditions,
  ScenarioEventCondition,
};
