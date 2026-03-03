"use server";

import { fetchNetWorthHistory } from "@/server/analysis/net-worth/net-worth-history";
import { clampDaysBack } from "@/server/ai/tools/helpers/time-range";
import {
  parseNetWorthMode,
  type NetWorthMode,
} from "@/server/analysis/net-worth/types";

const MIN_NON_ZERO_POINTS_FOR_RETURN_DRIFT = 365;
const MIN_NON_ZERO_SPAN_DAYS_FOR_RETURN_DRIFT = 365;
const MAX_ZERO_RATIO_FOR_RETURN_DRIFT = 0.15;

interface GetNetWorthHistoryParams {
  baseCurrency: string | null;
  daysBack: number | null;
  mode: NetWorthMode | null;
}

interface NetWorthHistoryItem {
  date: string;
  value: number;
}

function diffDaysInclusive(startDateKey: string, endDateKey: string): number {
  const startMs = Date.parse(`${startDateKey}T00:00:00Z`);
  const endMs = Date.parse(`${endDateKey}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

function analyzeHistoryQuality(items: NetWorthHistoryItem[]) {
  const firstNonZeroIndex = items.findIndex((item) => item.value > 0);
  // Trim only leading zero-only history (pre-activity padding).
  // Keep trailing zeros because they can represent real recent portfolio state.
  const representativeItems =
    firstNonZeroIndex > 0 ? items.slice(firstNonZeroIndex) : items;

  const nonZeroPoints = representativeItems.filter((item) => item.value > 0);
  const nonZeroCount = nonZeroPoints.length;
  const zeroCount = representativeItems.length - nonZeroCount;
  const zeroRatio =
    representativeItems.length > 0 ? zeroCount / representativeItems.length : 1;

  const firstNonZeroDate = nonZeroPoints[0]?.date ?? null;
  const lastNonZeroDate = nonZeroPoints[nonZeroCount - 1]?.date ?? null;
  const nonZeroSpanDays =
    firstNonZeroDate && lastNonZeroDate
      ? diffDaysInclusive(firstNonZeroDate, lastNonZeroDate)
      : 0;

  let driftSuitability: "suitable" | "insufficient_history" | "sparse_history" =
    "suitable";
  if (
    nonZeroCount < MIN_NON_ZERO_POINTS_FOR_RETURN_DRIFT ||
    nonZeroSpanDays < MIN_NON_ZERO_SPAN_DAYS_FOR_RETURN_DRIFT
  ) {
    driftSuitability = "insufficient_history";
  } else if (zeroRatio > MAX_ZERO_RATIO_FOR_RETURN_DRIFT) {
    driftSuitability = "sparse_history";
  }

  const guidance =
    driftSuitability === "suitable"
      ? "History is suitable as a return-drift input."
      : nonZeroCount === 0
        ? "No non-zero history found. Use traditional long-run market assumptions as base case."
        : "Use traditional long-run market assumptions as base case; use this history as sensitivity only.";

  return {
    representativeItems,
    historyQuality: {
      firstNonZeroDate,
      lastNonZeroDate,
      nonZeroCount,
      nonZeroSpanDays,
      zeroRatio: Number(zeroRatio.toFixed(4)),
      isSuitableForReturnDrift: driftSuitability === "suitable",
      driftSuitability,
      guidance,
    },
  };
}

export async function getNetWorthHistory(params: GetNetWorthHistoryParams) {
  const baseCurrency = params.baseCurrency ?? undefined;
  const daysBack = clampDaysBack({ requested: params.daysBack });
  const mode = parseNetWorthMode(params.mode);

  const history = await fetchNetWorthHistory({
    targetCurrency: baseCurrency,
    daysBack,
    mode,
  });

  const items = history.map((item) => ({
    date: item.dateKey,
    value: item.value,
  }));
  const { representativeItems, historyQuality } = analyzeHistoryQuality(items);

  return {
    total: history.length,
    returned: representativeItems.length,
    baseCurrency,
    daysBack,
    mode,
    period: {
      start: representativeItems[0]?.date ?? null,
      end: representativeItems[representativeItems.length - 1]?.date ?? null,
    },
    historyQuality,
    items: representativeItems,
  };
}
