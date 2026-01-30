import { BanknoteArrowDown } from "lucide-react";

import { ProjectedIncomeBarChart } from "@/components/dashboard/charts/projected-income/chart";

import type { ProjectedIncomeResult } from "@/server/analysis/projected-income/projected-income";

interface AssetProjectedIncomeProps {
  projectedIncome: ProjectedIncomeResult;
  dividendCurrency: string;
}

export function AssetProjectedIncome({
  projectedIncome,
  dividendCurrency,
}: AssetProjectedIncomeProps) {
  // Handle error state
  if (!projectedIncome.success) {
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <div className="bg-accent rounded-lg p-2">
          <BanknoteArrowDown className="text-muted-foreground size-4" />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          {projectedIncome.message || "Failed to load projected income data"}
        </p>
      </div>
    );
  }

  // Handle empty state
  if (!projectedIncome.data || projectedIncome.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <div className="bg-accent rounded-lg p-2">
          <BanknoteArrowDown className="text-muted-foreground size-4" />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          {projectedIncome.message || "No projected income data available"}
        </p>
      </div>
    );
  }

  // Display chart
  return (
    <div className="flex h-48 flex-col gap-3">
      <ProjectedIncomeBarChart
        data={projectedIncome.data}
        currency={dividendCurrency}
      />
    </div>
  );
}
