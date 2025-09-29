"use server";

import { format } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";

interface GetAllocationDriftParams {
  baseCurrency?: string;
  compareToDate: string; // YYYY-MM-DD
}

interface CategoryDrift {
  code: string;
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
    const { profile } = await fetchProfile();
    const baseCurrency = params.baseCurrency ?? profile.display_currency;

    const compareDate = new Date(params.compareToDate);
    const currentDate = new Date();
    const compareKey = format(compareDate, "yyyy-MM-dd");
    const currentKey = format(currentDate, "yyyy-MM-dd");

    // Get asset allocations for both dates using centralized function
    const [previousAllocation, currentAllocation] = await Promise.all([
      calculateAssetAllocation(baseCurrency, compareDate),
      calculateAssetAllocation(baseCurrency, currentDate),
    ]);

    // If no allocations, return empty state
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

    // Calculate totals
    const previousTotal = previousAllocation.reduce(
      (sum, cat) => sum + cat.total_value,
      0,
    );
    const currentTotal = currentAllocation.reduce(
      (sum, cat) => sum + cat.total_value,
      0,
    );

    // Create maps for easy lookup
    const prevByCode = new Map(
      previousAllocation.map((cat) => [cat.category_code, cat]),
    );
    const currByCode = new Map(
      currentAllocation.map((cat) => [cat.category_code, cat]),
    );

    // Get all unique category codes
    const allCodes = new Set([
      ...previousAllocation.map((cat) => cat.category_code),
      ...currentAllocation.map((cat) => cat.category_code),
    ]);

    // Build category drift list
    const categories: CategoryDrift[] = Array.from(allCodes).map((code) => {
      const prev = prevByCode.get(code);
      const curr = currByCode.get(code);

      const previousValue = prev?.total_value || 0;
      const currentValue = curr?.total_value || 0;
      const previousPct =
        previousTotal > 0 ? (previousValue / previousTotal) * 100 : 0;
      const currentPct =
        currentTotal > 0 ? (currentValue / currentTotal) * 100 : 0;
      const deltaPct = currentPct - previousPct;

      return {
        code,
        name: curr?.name || prev?.name || "",
        previousValue,
        currentValue,
        previousPct,
        currentPct,
        deltaPct,
      };
    });

    // Sort categories by absolute drift (largest change first)
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
