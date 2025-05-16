"use client";

import { useMemo } from "react";
import { Pie, PieChart, Label } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import {
  formatCurrency,
  formatPercentage,
  formatCompactCurrency,
} from "@/lib/number/format";
import { assetAllocation } from "@/mocks/financial/net-worth";

const chartConfig = {
  value: {
    label: "Value",
  },
  cash: {
    label: "Cash",
    color: "var(--chart-0)",
  },
  equity: {
    label: "Equity",
    color: "var(--chart-1)",
  },
  fixed_income: {
    label: "Fixed Income",
    color: "var(--chart-2)",
  },
  real_estate: {
    label: "Real Estate",
    color: "var(--chart-3)",
  },
  cryptocurrency: {
    label: "Crypto",
    color: "var(--chart-4)",
  },
  other: {
    label: "Other",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

export function AssetAllocationDonutChart({
  netWorth,
  currency,
}: {
  netWorth: number;
  currency: string;
}) {
  // Calculate total value for percentage calculation
  const totalValue = useMemo(() => {
    return assetAllocation.reduce((sum, item) => sum + item.value, 0);
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
          className="mx-auto aspect-square h-56 w-full"
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
                    formatCurrency(Number(value), currency)
                  }
                />
              }
            />
            <Pie
              data={assetAllocation}
              dataKey="value"
              nameKey="category"
              innerRadius={"65%"}
              outerRadius={"80%"}
              paddingAngle={2}
              cornerRadius={99}
              labelLine={false}
              startAngle={90}
              endAngle={-270}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          fill="var(--foreground)"
                          fontSize={16}
                          fontWeight="bolder"
                        >
                          {formatCompactCurrency(netWorth, currency)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          fill="var(--muted-foreground)"
                          fontSize={12}
                        >
                          Net Worth
                        </tspan>
                      </text>
                    );
                  }
                  return null;
                }}
                position="center"
              />
            </Pie>
            <ChartLegend
              align="right"
              layout="vertical"
              verticalAlign="middle"
              wrapperStyle={{ width: "40%" }}
              className="flex max-h-56 flex-col items-start gap-2 overflow-hidden p-0"
              content={
                <ChartLegendContent
                  nameKey="category"
                  labelFormatter={(label) => getCategoryLabel(String(label))}
                  valueFormatter={(value) => {
                    const percentage = (Number(value) / totalValue) * 100;
                    return formatPercentage(percentage / 100, 1);
                  }}
                  valueClassName="text-muted-foreground"
                />
              }
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
