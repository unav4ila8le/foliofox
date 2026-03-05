import type { LocalDate } from "@/lib/date/date-utils";
import type { ScenarioEvent } from "./helpers";

interface ScenarioEventDateRange {
  startDate: Date | undefined;
  endDate: Date | undefined;
}

const localDateToDate = (localDate: LocalDate): Date =>
  new Date(localDate.y, localDate.m - 1, localDate.d);

const getScenarioEventDateRange = (
  event: ScenarioEvent | null | undefined,
): ScenarioEventDateRange => {
  if (!event) {
    return {
      startDate: undefined,
      endDate: undefined,
    };
  }

  const dateRangeCondition = event.unlockedBy.find(
    (condition) =>
      condition.tag === "cashflow" && condition.type === "date-in-range",
  );

  if (dateRangeCondition && dateRangeCondition.type === "date-in-range") {
    return {
      startDate: localDateToDate(dateRangeCondition.value.start),
      endDate: dateRangeCondition.value.end
        ? localDateToDate(dateRangeCondition.value.end)
        : undefined,
    };
  }

  const dateIsCondition = event.unlockedBy.find(
    (condition) => condition.tag === "cashflow" && condition.type === "date-is",
  );

  if (dateIsCondition && dateIsCondition.type === "date-is") {
    return {
      startDate: localDateToDate(dateIsCondition.value),
      endDate: undefined,
    };
  }

  return {
    startDate: undefined,
    endDate: undefined,
  };
};

export { getScenarioEventDateRange };
