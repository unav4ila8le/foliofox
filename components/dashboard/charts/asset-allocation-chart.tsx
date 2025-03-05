"use client";

import { Pie, PieChart } from "recharts";
import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { formatCurrency, formatPercentage } from "@/lib/number/format";

// Mock data representing asset allocation based on the project schema
const chartData = [
  { category: "stocks", value: 42500, fill: "var(--color-stocks)" },
  { category: "crypto", value: 15000, fill: "var(--color-crypto)" },
  { category: "cash", value: 8500, fill: "var(--color-cash)" },
  { category: "real_estate", value: 90000, fill: "var(--color-real_estate)" },
  {
    category: "other_assets",
    value: 19500,
    fill: "var(--color-other_assets)",
  },
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
    label: "Crypto",
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
    label: "Other",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

export function AssetAllocationChart() {
  // Calculate total value for percentage calculation
  const totalValue = React.useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, []);

  // Function to get the human-readable label from chartConfig
  const getCategoryLabel = (category: string) => {
    // Use type assertion to tell TypeScript that category is a valid key
    if (category in chartConfig) {
      return (
        chartConfig[category as keyof typeof chartConfig]?.label || category
      );
    }
    return category;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-64 w-full"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  indicator="line"
                  className="min-w-auto"
                  valueFormatter={(value) =>
                    formatCurrency(Number(value), "USD")
                  }
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="category"
              innerRadius={40}
              labelLine={false}
              label={({ payload, ...props }) => {
                // Calculate percentage for this slice
                const percentage = (payload.value / totalValue) * 100;

                return (
                  <text
                    cx={props.cx}
                    cy={props.cy}
                    x={props.x}
                    y={props.y}
                    textAnchor={props.textAnchor}
                    dominantBaseline={props.dominantBaseline}
                  >
                    <tspan
                      x={props.x}
                      dy="0"
                      fill="var(--foreground)"
                      fontSize={13}
                    >
                      {getCategoryLabel(payload.category)}
                    </tspan>
                    <tspan
                      x={props.x}
                      dy="1.2em"
                      fill="var(--muted-foreground)"
                      fontSize={12}
                    >
                      {formatPercentage(percentage / 100, 1)}
                    </tspan>
                  </text>
                );
              }}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
