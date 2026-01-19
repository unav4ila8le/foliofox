import { Database } from "@/types/database.types";
import { z } from "zod";
import { LocalDate } from "@/lib/date-format";

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

const BalanceConditions = z.discriminatedUnion("type", [
  z.object({
    tag: z.literal("balance"),
    type: z.literal("networth-is-above"),
    value: z.object({
      eventRef: z.string(),
      amount: z.number(),
    }),
  }),
  z.object({
    tag: z.literal("balance"),
    type: z.literal("event-happened"),
    value: z.object({
      eventName: z.string(),
    }),
  }),
  z.object({
    tag: z.literal("balance"),
    type: z.literal("income-is-above"),
    value: z.object({
      eventName: z.string(),
      amount: z.number(),
    }),
  }),
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
  unlockedBy: z.array(
    z.discriminatedUnion("tag", [CashflowConditions, BalanceConditions]),
  ),
  metadata: z.record(z.string(), z.string()).optional(),
});

const Scenario = z.object({
  name: z.string(),
  events: z.array(ScenarioEvent),
});

type Scenario = z.infer<typeof Scenario>;
type ScenarioEvent = z.infer<typeof ScenarioEvent>;
type CashflowConditions = z.infer<typeof CashflowConditions>;
type BalanceConditions = z.infer<typeof BalanceConditions>;

//-- Converters
type DatabaseScenario =
  Database["public"]["Tables"]["financial_scenarios"]["Row"];

const fromDatabaseScenarioToScenario = (
  database: DatabaseScenario,
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
  BalanceConditions,
};
