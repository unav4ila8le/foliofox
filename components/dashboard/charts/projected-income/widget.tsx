import { BanknoteArrowDown } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProjectedIncomeBarChart } from "./chart";

import type { ProjectedIncomeResult } from "@/server/analysis/projected-income";

interface ProjectedIncomeWidgetProps {
  projectedIncome: ProjectedIncomeResult;
  currency: string;
}

export function ProjectedIncomeWidget({
  projectedIncome,
  currency,
}: ProjectedIncomeWidgetProps) {
  // Handle error state
  if (!projectedIncome.success) {
    return (
      <Card className="flex h-80 flex-col gap-4">
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
      <Card className="flex h-80 flex-col gap-4">
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

  return (
    <Card className="flex h-80 flex-col gap-4">
      <CardHeader className="flex-none">
        <CardTitle>Projected Income</CardTitle>
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
