import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProjectedIncomeBarChart } from "./chart";

export function ProjectedIncomeWidget() {
  return (
    <Card className="flex h-80 flex-col gap-4">
      <CardHeader className="flex-none">
        <CardTitle>Projected Income</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <ProjectedIncomeBarChart />
      </CardContent>
    </Card>
  );
}
