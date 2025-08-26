import { BanknoteArrowDown } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProjectedIncomeBarChart } from "./chart";

import type { ProjectedIncomeData } from "@/types/global.types";

interface ProjectedIncomeWidgetProps {
  data: ProjectedIncomeData[];
  currency: string;
}

export function ProjectedIncomeWidget({
  data,
  currency,
}: ProjectedIncomeWidgetProps) {
  if (data.length === 0) {
    return (
      <Card className="flex h-80 flex-col gap-4">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <BanknoteArrowDown className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Projected Income</p>
          <p className="text-muted-foreground mt-1 text-sm">
            No projected income or dividend data available for your portfolio
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex h-80 flex-col gap-4">
      <CardHeader className="flex-none">
        <CardTitle>Projected Income</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <ProjectedIncomeBarChart data={data} currency={currency} />
      </CardContent>
    </Card>
  );
}
