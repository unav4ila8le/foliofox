"use client";

import { Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

// Mock data representing asset allocation based on the project schema
const chartData = [
  { category: "stocks", value: 42500, fill: "var(--color-stocks)" },
  { category: "crypto", value: 15000, fill: "var(--color-crypto)" },
  { category: "cash", value: 8500, fill: "var(--color-cash)" },
  { category: "real_estate", value: 90000, fill: "var(--color-real_estate)" },
  { category: "other_assets", value: 19500, fill: "var(--color-other_assets)" },
];

const chartConfig = {
  value: {
    label: "Value",
  },
  stocks: {
    label: "Stocks",
    color: "var(--chart-0)",
  },
  crypto: {
    label: "Cryptocurrency",
    color: "var(--chart-1)",
  },
  cash: {
    label: "Cash",
    color: "var(--chart-2)",
  },
  real_estate: {
    label: "Real Estate",
    color: "var(--chart-3)",
  },
  other_assets: {
    label: "Other Assets",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

export function AssetAllocationChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-48 w-full"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="category"
              innerRadius={30}
              paddingAngle={2}
            />
            <ChartLegend
              content={<ChartLegendContent nameKey="category" />}
              className="flex-wrap gap-x-4 gap-y-2 pt-0"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
