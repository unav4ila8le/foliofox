"use client";

import { useState } from "react";
import { differenceInWeeks, startOfYear, format } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";

import {
  fetchNetWorthHistory,
  NetWorthHistoryData,
} from "@/server/analysis/net-worth-history";
import {
  fetchNetWorthChange,
  NetWorthChangeData,
} from "@/server/analysis/net-worth-change";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { NewHoldingButton } from "@/components/dashboard/new-holding";
import { ImportHoldingsButton } from "@/components/dashboard/holdings/import";

import {
  formatCompactNumber,
  formatCurrency,
  formatNumber,
} from "@/lib/number-format";
import { cn } from "@/lib/utils";

export function NetWorthLineChart({
  currency,
  netWorth,
  history: initialHistory,
  change: initialChange,
}: {
  currency: string;
  netWorth: number;
  history: NetWorthHistoryData[];
  change: NetWorthChangeData;
}) {
  const [customTimeRange, setCustomTimeRange] = useState<{
    history: NetWorthHistoryData[];
    change: NetWorthChangeData;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Display custom time range data or fall back to default initial data (6 months)
  const history = customTimeRange?.history ?? initialHistory;
  const change = customTimeRange?.change ?? initialChange;

  const handleWeeksChange = async (weeks: string) => {
    setIsLoading(true);

    try {
      const weeksBackNum =
        weeks === "ytd"
          ? Math.ceil(differenceInWeeks(new Date(), startOfYear(new Date())))
          : Number(weeks);

      // Fetch both history and change in parallel
      const [newHistory, newChange] = await Promise.all([
        fetchNetWorthHistory({
          targetCurrency: currency,
          weeksBack: weeksBackNum,
        }),
        fetchNetWorthChange({
          targetCurrency: currency,
          weeksBack: weeksBackNum,
        }),
      ]);

      setCustomTimeRange({
        history: newHistory,
        change: newChange,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format date for display on X-axis
  const formatXAxisDate = (date: Date) => {
    return format(date, "MMM d");
  };

  // Format value for display on Y-axis
  const formatYAxisValue = (value: number) => {
    return formatCompactNumber(value);
  };

  // Define area chart color based on percentage change
  const chartColor =
    change.percentageChange >= 0
      ? "oklch(0.63 0.17 149)"
      : "oklch(0.58 0.22 27)";

  return (
    <Card className="flex h-80 flex-col">
      {netWorth === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <TrendingUp className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">No net worth history available yet</p>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Add your holdings to start tracking your net worth
          </p>
          <div className="flex items-center justify-center gap-2">
            <NewHoldingButton variant="outline" />
            <ImportHoldingsButton variant="outline" />
          </div>
        </div>
      ) : (
        <>
          <CardHeader className="flex-none">
            <div className="flex justify-between gap-4">
              <div>
                <CardDescription>Net Worth</CardDescription>
                <div className="flex flex-col md:flex-row md:items-baseline-last md:gap-3">
                  <h2 className="text-xl font-semibold">
                    {formatCurrency(netWorth, currency)}
                  </h2>
                  <div className="flex items-center gap-1 text-sm">
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        change.absoluteChange >= 0
                          ? "text-green-600"
                          : "text-red-600",
                      )}
                    >
                      {change.absoluteChange >= 0 ? (
                        <TrendingUp className="size-4" />
                      ) : (
                        <TrendingDown className="size-4" />
                      )}
                      <span>
                        {change.absoluteChange >= 0 ? "+" : ""}
                        {formatNumber(change.absoluteChange, undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        ({change.percentageChange >= 0 ? "+" : ""}
                        {change.previousValue === 0
                          ? "N/A"
                          : change.percentageChange.toFixed(2)}
                        %)
                      </span>
                    </div>
                    <span className="text-muted-foreground hidden md:block">
                      vs last period
                    </span>
                  </div>
                </div>
              </div>
              <Select
                defaultValue="24"
                onValueChange={handleWeeksChange}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="6 Months" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="4">1 Month</SelectItem>
                  <SelectItem value="12">3 Months</SelectItem>
                  <SelectItem value="24">6 Months</SelectItem>
                  <SelectItem value="ytd">YTD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent
            className={cn(
              "flex-1 transition-opacity",
              isLoading && "opacity-50",
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={chartColor}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor={chartColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <YAxis
                  dataKey="value"
                  tickFormatter={formatYAxisValue}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  domain={["auto", "auto"]}
                  width={40}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatXAxisDate}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={5}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;

                    const data = payload[0];
                    return (
                      <div className="bg-background border-border flex flex-col gap-1 rounded-md border px-2.5 py-1.5">
                        <span className="text-muted-foreground text-xs">
                          {format(data.payload.date, "PPP")}
                        </span>
                        <span className="text-sm">
                          {formatCurrency(Number(data.value), currency)}
                        </span>
                      </div>
                    );
                  }}
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                />
                <Area
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  fill="url(#areaGradient)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{
                    r: 4.5,
                    strokeWidth: 2.5,
                    filter: "drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.3))",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </>
      )}
    </Card>
  );
}
