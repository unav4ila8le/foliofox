"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Label,
  Tooltip,
} from "recharts";
import { ChartPie } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import {
  formatCompactCurrency,
  formatCurrency,
  formatPercentage,
} from "@/lib/number-format";

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
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <ChartPie className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Asset Allocation</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Your holdings will appear here once you add them
          </p>
        </CardContent>
      ) : (
        <>
          <CardHeader className="flex-none">
            <CardTitle>Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent className="mt-6 flex flex-1">
            {/* Pie chart container with minimum width */}
            <div className="w-3/5 min-w-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
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
                      value={formatCompactCurrency(netWorth, currency)}
                      position="center"
                      style={{
                        fontSize: "16px",
                        fontWeight: "bolder",
                        fill: "var(--foreground)",
                      }}
                      dy={-5}
                    />
                    <Label
                      value="Net Worth"
                      position="center"
                      style={{
                        fontSize: "12px",
                        fill: "var(--muted-foreground)",
                      }}
                      dy={15}
                    />
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 10 }}
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
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Custom legend outside ResponsiveContainer */}
            <div className="flex flex-1 items-center">
              <ul className="flex w-full flex-col gap-2">
                {assetAllocation.map((item, index) => (
                  <li key={`item-${index}`} className="w-full">
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-1 h-2 w-2 shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs">
                          {item.name}{" "}
                          <span className="text-muted-foreground">
                            {formatPercentage(
                              item.total_value / totalHoldingsValue,
                            )}
                          </span>
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}
