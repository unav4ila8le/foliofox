import { BanknoteArrowDown } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProjectedIncomeBarChart } from "./chart";

import { formatCurrency } from "@/lib/number-format";
import { cn } from "@/lib/utils";

import type { ProjectedIncomeResult } from "@/server/analysis/projected-income";

interface ProjectedIncomeWidgetProps {
  projectedIncome: ProjectedIncomeResult;
  currency: string;
  className?: string;
}

export function ProjectedIncomeWidget({
  projectedIncome,
  currency,
  className,
}: ProjectedIncomeWidgetProps) {
  // Handle error state
  if (!projectedIncome.success) {
    return (
      <Card className={cn("flex h-80 flex-col gap-4", className)}>
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <BanknoteArrowDown className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Projected Income</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {projectedIncome.message || "Failed to load projected income data"}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Handle empty state
  if (!projectedIncome.data || projectedIncome.data.length === 0) {
    return (
      <Card className={cn("flex h-80 flex-col gap-4", className)}>
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <BanknoteArrowDown className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Projected Income</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {projectedIncome.message || "No projected income data available"}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate total annual projected income
  const totalAnnualIncome = projectedIncome.data.reduce(
    (sum, month) => sum + month.income,
    0,
  );

  return (
    <Card className={cn("flex h-80 flex-col gap-4", className)}>
      <CardHeader className="flex flex-none justify-between">
        <CardTitle>Projected Income</CardTitle>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">Est. Annual</p>
          <p className="text-sm text-green-600">
            {formatCurrency(totalAnnualIncome, currency)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ProjectedIncomeBarChart
          data={projectedIncome.data}
          currency={currency}
        />
      </CardContent>
    </Card>
  );
}
