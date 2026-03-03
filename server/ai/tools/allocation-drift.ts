"use server";

import { fetchProfile } from "@/server/profile/actions";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";
import { resolveTodayDateKey, toCivilDateKey } from "@/lib/date/date-utils";

interface GetAllocationDriftParams {
  baseCurrency: string | null;
  compareToDate: string; // YYYY-MM-DD
}

interface CategoryDrift {
  id: string;
  name: string;
  previousValue: number;
  currentValue: number;
  previousPct: number;
  currentPct: number;
  deltaPct: number; // currentPct - previousPct (percentage points)
}

/**
 * Compare asset allocation now vs a past date and report % drift by category.
 */
export async function getAllocationDrift(params: GetAllocationDriftParams) {
  try {
    // 1. Resolve profile once for default currency and civil "today".
    const { profile } = await fetchProfile();
    const baseCurrency = params.baseCurrency ?? profile.display_currency;
    const todayDateKey = resolveTodayDateKey(profile.time_zone);
    const compareKey = toCivilDateKey(params.compareToDate) ?? todayDateKey;
    const currentKey = todayDateKey;

    // 2. Get asset allocations for both dates using centralized function.
    const [previousAllocation, currentAllocation] = await Promise.all([
      calculateAssetAllocation(baseCurrency, compareKey),
      calculateAssetAllocation(baseCurrency, currentKey),
    ]);

    // 3. If no allocations, return empty state.
    if (!previousAllocation.length && !currentAllocation.length) {
      return {
        baseCurrency,
        compareToDate: compareKey,
        currentDate: currentKey,
        totals: { previous: 0, current: 0 },
        categories: [] as CategoryDrift[],
        topDrifts: {
          positive: [] as CategoryDrift[],
          negative: [] as CategoryDrift[],
        },
      };
    }

    // 4. Calculate totals.
    const previousTotal = previousAllocation.reduce(
      (sum, cat) => sum + cat.total_value,
      0,
    );
    const currentTotal = currentAllocation.reduce(
      (sum, cat) => sum + cat.total_value,
      0,
    );

    // 5. Create maps for easy lookup.
    const prevById = new Map(
      previousAllocation.map((cat) => [cat.category_id, cat]),
    );
    const currById = new Map(
      currentAllocation.map((cat) => [cat.category_id, cat]),
    );

    // 6. Get all unique category codes.
    const allIds = new Set([
      ...previousAllocation.map((cat) => cat.category_id),
      ...currentAllocation.map((cat) => cat.category_id),
    ]);

    // 7. Build category drift list.
    const categories: CategoryDrift[] = Array.from(allIds).map((id) => {
      const prev = prevById.get(id);
      const curr = currById.get(id);

      const previousValue = prev?.total_value || 0;
      const currentValue = curr?.total_value || 0;
      const previousPct =
        previousTotal > 0 ? (previousValue / previousTotal) * 100 : 0;
      const currentPct =
        currentTotal > 0 ? (currentValue / currentTotal) * 100 : 0;
      const deltaPct = currentPct - previousPct;

      return {
        id,
        name: curr?.name || prev?.name || "",
        previousValue,
        currentValue,
        previousPct,
        currentPct,
        deltaPct,
      };
    });

    // 8. Sort categories by absolute drift (largest change first).
    categories.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

    const positive = categories.filter((c) => c.deltaPct > 0).slice(0, 5);
    const negative = categories.filter((c) => c.deltaPct < 0).slice(0, 5);

    return {
      baseCurrency,
      compareToDate: compareKey,
      currentDate: currentKey,
      totals: { previous: previousTotal, current: currentTotal },
      categories,
      topDrifts: { positive, negative },
    };
  } catch (error) {
    console.error("Error calculating allocation drift:", error);
    throw new Error(
      `Failed to calculate allocation drift: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
