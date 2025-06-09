"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Label,
  Tooltip,
  Legend,
} from "recharts";
import { ChartPie } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import {
  formatCompactCurrency,
  formatCurrency,
  formatPercentage,
} from "@/lib/number/format";

const COLORS = [
  "var(--chart-0)",
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function AssetAllocationDonut({
  netWorth,
  currency,
  assetAllocation,
}: {
  netWorth: number;
  currency: string;
  assetAllocation: Array<{
    category_code: string;
    name: string;
    total_value: number;
  }>;
}) {
  // Calculate total value for percentage calculation
  const totalHoldingsValue = useMemo(() => {
    return assetAllocation.reduce((sum, item) => sum + item.total_value, 0);
  }, [assetAllocation]);

  return (
    <Card className="flex h-64 flex-col gap-0 md:h-80">
      {assetAllocation.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <ChartPie className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">No asset allocation to display</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Your holdings will appear here once you add them
          </p>
        </div>
      ) : (
        <>
          <CardHeader className="flex-none">
            <CardTitle>Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent className="mt-6 flex-1">
            <ResponsiveContainer
              width="100%"
              height="100%"
              className="[&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden"
            >
              <PieChart>
                <Pie
                  data={assetAllocation}
                  dataKey="total_value"
                  nameKey="name"
                  innerRadius={"80%"}
                  outerRadius={"90%"}
                  paddingAngle={2}
                  cornerRadius={99}
                  labelLine={false}
                >
                  {assetAllocation.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="none"
                    />
                  ))}
                  <Label
                    position="center"
                    offset={0}
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
                  />
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;

                    const data = payload[0];
                    return (
                      <div className="bg-background border-border flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                        <div
                          className="h-3 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: data.payload.fill }}
                        />
                        <span className="text-muted-foreground text-xs">
                          {data.payload.name}
                        </span>
                        <span className="text-foreground text-xs font-semibold">
                          {formatCurrency(Number(data.value), currency)}
                        </span>
                      </div>
                    );
                  }}
                />
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  wrapperStyle={{ width: "40%", right: 0 }}
                  content={({ payload }) => {
                    if (payload)
                      return (
                        <ul className="flex flex-col gap-2">
                          {payload.map((entry, index) => (
                            <li key={`item-${index}`}>
                              <div className="flex items-center gap-1">
                                <div
                                  className="h-2 w-2 shrink-0 rounded-[2px]"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-xs">
                                  {entry.value}{" "}
                                  <span className="text-muted-foreground text-xs">
                                    {formatPercentage(
                                      entry.payload?.value / totalHoldingsValue,
                                    )}
                                  </span>
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      );
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </>
      )}
    </Card>
  );
}
