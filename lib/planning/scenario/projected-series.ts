import {
  SCENARIO_INITIAL_VALUE_BASIS_LABELS,
  type ScenarioInitialValueBasis,
} from "@/lib/planning/initial-value-basis";
import type {
  ProjectedSeriesConditions,
  ScenarioEvent,
  ScenarioEventCondition,
} from "./helpers";

const SCENARIO_PROJECTED_SERIES_THRESHOLD_CONDITION_TYPES = [
  "networth-is-above",
  "cash-is-above",
] as const;

type ScenarioProjectedSeriesThresholdConditionType =
  (typeof SCENARIO_PROJECTED_SERIES_THRESHOLD_CONDITION_TYPES)[number];

type ScenarioProjectedSeriesThresholdCondition = Extract<
  ProjectedSeriesConditions,
  { type: ScenarioProjectedSeriesThresholdConditionType }
>;

const PROJECTED_SERIES_THRESHOLD_LABELS: Record<
  ScenarioProjectedSeriesThresholdConditionType,
  string
> = {
  "networth-is-above": "Net Worth is Above",
  "cash-is-above": "Cash is Above",
};

const PROJECTED_SERIES_LABELS: Record<ScenarioInitialValueBasis, string> = {
  net_worth: "Net Worth",
  cash: "Cash",
  manual: "Value",
};

const PROJECTED_SERIES_SUBJECT_LABELS: Record<
  ScenarioInitialValueBasis,
  string
> = {
  net_worth: "net worth",
  cash: "cash",
  manual: "scenario value",
};

const isProjectedSeriesThresholdConditionType = (
  value: string,
): value is ScenarioProjectedSeriesThresholdConditionType =>
  SCENARIO_PROJECTED_SERIES_THRESHOLD_CONDITION_TYPES.some(
    (type) => type === value,
  );

const isProjectedSeriesThresholdCondition = (
  condition: ScenarioEventCondition,
): condition is ScenarioProjectedSeriesThresholdCondition =>
  condition.tag === "projected-series" &&
  isProjectedSeriesThresholdConditionType(condition.type);

const getProjectedSeriesThresholdConditionTypeForBasis = (
  basis: ScenarioInitialValueBasis,
): ScenarioProjectedSeriesThresholdConditionType | null => {
  if (basis === "net_worth") {
    return "networth-is-above";
  }

  if (basis === "cash") {
    return "cash-is-above";
  }

  return null;
};

const getProjectedSeriesThresholdConditionLabel = (
  conditionType: ScenarioProjectedSeriesThresholdConditionType,
): string => PROJECTED_SERIES_THRESHOLD_LABELS[conditionType];

const getProjectedSeriesLabel = (basis: ScenarioInitialValueBasis): string =>
  PROJECTED_SERIES_LABELS[basis];

const getProjectedSeriesTitle = (basis: ScenarioInitialValueBasis): string =>
  `Projected ${getProjectedSeriesLabel(basis)} Over Time`;

const getProjectedSeriesDescription = (
  basis: ScenarioInitialValueBasis,
): string =>
  `Financial projection of your ${PROJECTED_SERIES_SUBJECT_LABELS[basis]} with conditional events`;

const getProjectedNetChangeLabel = (basis: ScenarioInitialValueBasis): string =>
  `Projected ${getProjectedSeriesLabel(basis)} Change`;

const getLowestProjectedSeriesLabel = (
  basis: ScenarioInitialValueBasis,
): string => `Lowest Projected ${getProjectedSeriesLabel(basis)}`;

const getAverageProjectedSeriesChangeLabel = (
  basis: ScenarioInitialValueBasis,
): string => `Avg. Monthly ${getProjectedSeriesLabel(basis)} Change`;

const getFinalProjectedSeriesLabel = (
  basis: ScenarioInitialValueBasis,
): string => `Final Projected ${getProjectedSeriesLabel(basis)}`;

const isProjectedSeriesThresholdConditionCompatibleWithBasis = (
  condition: ScenarioProjectedSeriesThresholdCondition,
  basis: ScenarioInitialValueBasis,
): boolean => {
  const allowedConditionType =
    getProjectedSeriesThresholdConditionTypeForBasis(basis);
  return allowedConditionType === condition.type;
};

const eventHasIncompatibleProjectedSeriesThresholdCondition = (
  event: ScenarioEvent,
  basis: ScenarioInitialValueBasis,
): boolean =>
  event.unlockedBy.some(
    (condition) =>
      condition.tag === "projected-series" &&
      isProjectedSeriesThresholdCondition(condition) &&
      !isProjectedSeriesThresholdConditionCompatibleWithBasis(condition, basis),
  );

const convertProjectedSeriesThresholdCondition = (
  condition: ProjectedSeriesConditions,
  basis: ScenarioInitialValueBasis,
): ProjectedSeriesConditions => {
  if (!isProjectedSeriesThresholdCondition(condition)) {
    return condition;
  }

  const targetConditionType =
    getProjectedSeriesThresholdConditionTypeForBasis(basis);
  if (!targetConditionType) {
    return condition;
  }

  if (condition.type === targetConditionType) {
    return condition;
  }

  return {
    ...condition,
    type: targetConditionType,
    value: {
      ...condition.value,
    },
  };
};

const convertScenarioEventProjectedSeriesThresholdConditions = (
  event: ScenarioEvent,
  basis: ScenarioInitialValueBasis,
): ScenarioEvent => ({
  ...event,
  unlockedBy: event.unlockedBy.map((condition) => {
    if (condition.tag !== "projected-series") {
      return condition;
    }

    return convertProjectedSeriesThresholdCondition(condition, basis);
  }),
});

const convertScenarioEventsProjectedSeriesThresholdConditions = (
  events: ScenarioEvent[],
  basis: ScenarioInitialValueBasis,
): ScenarioEvent[] => {
  if (basis === "manual") {
    return events;
  }

  return events.map((event) =>
    convertScenarioEventProjectedSeriesThresholdConditions(event, basis),
  );
};

const getBasisCompatibilityDescription = (
  basis: ScenarioInitialValueBasis,
): string => {
  if (basis === "manual") {
    return "Inactive while Initial value uses Manual basis.";
  }

  return `Inactive while Initial value uses ${SCENARIO_INITIAL_VALUE_BASIS_LABELS[basis]} basis.`;
};

export {
  type ScenarioProjectedSeriesThresholdCondition,
  type ScenarioProjectedSeriesThresholdConditionType,
  convertScenarioEventProjectedSeriesThresholdConditions,
  convertScenarioEventsProjectedSeriesThresholdConditions,
  eventHasIncompatibleProjectedSeriesThresholdCondition,
  getAverageProjectedSeriesChangeLabel,
  getBasisCompatibilityDescription,
  getFinalProjectedSeriesLabel,
  getLowestProjectedSeriesLabel,
  getProjectedNetChangeLabel,
  getProjectedSeriesDescription,
  getProjectedSeriesLabel,
  getProjectedSeriesThresholdConditionLabel,
  getProjectedSeriesThresholdConditionTypeForBasis,
  getProjectedSeriesTitle,
  isProjectedSeriesThresholdCondition,
  isProjectedSeriesThresholdConditionCompatibleWithBasis,
  isProjectedSeriesThresholdConditionType,
};
