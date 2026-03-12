import type { CivilDateKey } from "@/lib/date/date-utils";

export const PERFORMANCE_METHODOLOGIES = [
  "time_weighted_return",
  "money_weighted_return",
] as const;

export type PerformanceMethodology = (typeof PERFORMANCE_METHODOLOGIES)[number];

export function parsePerformanceMethodology(
  value: string | null | undefined,
): PerformanceMethodology {
  return value === "money_weighted_return"
    ? "money_weighted_return"
    : "time_weighted_return";
}

export const PERFORMANCE_SCOPES = ["symbol_assets"] as const;

export type PerformanceScope = (typeof PERFORMANCE_SCOPES)[number];

export function parsePerformanceScope(
  value: string | null | undefined,
): PerformanceScope {
  return value === "symbol_assets" ? "symbol_assets" : "symbol_assets";
}

export const PERFORMANCE_UNAVAILABLE_REASONS = [
  "no_eligible_positions",
  "insufficient_history",
] as const;

export type PerformanceUnavailableReason =
  (typeof PERFORMANCE_UNAVAILABLE_REASONS)[number];

export interface PerformanceEligibilityData {
  isEligible: boolean;
  unavailableReason: PerformanceUnavailableReason | null;
  message: string | null;
}

export interface PerformanceHistoryPoint {
  date: Date;
  dateKey: CivilDateKey;
  cumulativeReturnPct: number;
}

export interface PerformanceSummaryData {
  startDateKey: CivilDateKey;
  endDateKey: CivilDateKey;
  cumulativeReturnPct: number;
}

export interface AvailablePerformanceRangeData {
  isAvailable: true;
  methodology: PerformanceMethodology;
  scope: PerformanceScope;
  history: PerformanceHistoryPoint[];
  summary: PerformanceSummaryData;
  includesEstimatedFlows: boolean;
  unavailableReason: null;
  message: null;
}

export interface UnavailablePerformanceRangeData {
  isAvailable: false;
  methodology: PerformanceMethodology;
  scope: PerformanceScope;
  history: [];
  summary: null;
  unavailableReason: PerformanceUnavailableReason;
  message: string;
}

export type PerformanceRangeData =
  | AvailablePerformanceRangeData
  | UnavailablePerformanceRangeData;
