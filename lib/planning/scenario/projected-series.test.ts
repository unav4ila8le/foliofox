import { describe, expect, test } from "vitest";

import type { ScenarioEvent } from "./helpers";
import { ScenarioEvent as ScenarioEventSchema } from "./helpers";
import {
  convertScenarioEventProjectedSeriesThresholdConditions,
  convertScenarioEventsProjectedSeriesThresholdConditions,
  eventHasIncompatibleProjectedSeriesThresholdCondition,
} from "./projected-series";
import { ld } from "@/lib/date/date-utils";

const thresholdEvent: ScenarioEvent = {
  name: "Buy Car",
  type: "expense",
  amount: 15000,
  recurrence: { type: "once" },
  unlockedBy: [
    {
      tag: "projected-series",
      type: "networth-is-above",
      value: { eventRef: "", amount: 60000 },
    },
    {
      tag: "cashflow",
      type: "date-is",
      value: ld(2027, 3, 10),
    },
  ],
};

describe("scenario projected series helpers", () => {
  test("parses the new cash threshold condition", () => {
    const parsed = ScenarioEventSchema.parse({
      ...thresholdEvent,
      unlockedBy: [
        {
          tag: "projected-series",
          type: "cash-is-above",
          value: { eventRef: "", amount: 25000 },
        },
      ],
    });

    expect(parsed.unlockedBy).toEqual([
      {
        tag: "projected-series",
        type: "cash-is-above",
        value: { eventRef: "", amount: 25000 },
      },
    ]);
  });

  test("converts threshold conditions when switching basis", () => {
    const converted = convertScenarioEventProjectedSeriesThresholdConditions(
      thresholdEvent,
      "cash",
    );

    expect(converted.unlockedBy).toEqual([
      {
        tag: "projected-series",
        type: "cash-is-above",
        value: { eventRef: "", amount: 60000 },
      },
      {
        tag: "cashflow",
        type: "date-is",
        value: ld(2027, 3, 10),
      },
    ]);
  });

  test("preserves non-time conditions during conversion", () => {
    const recurringEvent: ScenarioEvent = {
      ...thresholdEvent,
      recurrence: { type: "monthly" },
      unlockedBy: [
        ...thresholdEvent.unlockedBy,
        {
          tag: "event",
          type: "event-happened",
          value: { eventName: "Emergency Fund" },
        },
      ],
    };

    const converted = convertScenarioEventsProjectedSeriesThresholdConditions(
      [recurringEvent],
      "cash",
    );

    expect(converted[0].unlockedBy).toEqual([
      {
        tag: "projected-series",
        type: "cash-is-above",
        value: { eventRef: "", amount: 60000 },
      },
      {
        tag: "cashflow",
        type: "date-is",
        value: ld(2027, 3, 10),
      },
      {
        tag: "event",
        type: "event-happened",
        value: { eventName: "Emergency Fund" },
      },
    ]);
  });

  test("flags threshold conditions as incompatible in manual basis", () => {
    expect(
      eventHasIncompatibleProjectedSeriesThresholdCondition(
        thresholdEvent,
        "manual",
      ),
    ).toBe(true);
  });
});
