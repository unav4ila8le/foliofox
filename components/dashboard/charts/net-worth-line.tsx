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
  LineChart,
  Line,
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

import {
  formatCompactNumber,
  formatCurrency,
  formatNumber,
} from "@/lib/number/format";
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
  const [history, setHistory] = useState(initialHistory);
  const [change, setChange] = useState(initialChange);
  const [isLoading, setIsLoading] = useState(false);

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

      setHistory(newHistory);
      setChange(newChange);
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

  return (
    <Card className="flex h-80 flex-col">
      <CardHeader className="flex-none">
        <div className="flex justify-between gap-4">
          <div>
            <CardDescription>Net Worth</CardDescription>
            <div className="flex items-baseline-last gap-3">
              <h2 className="text-xl font-semibold">
                {formatCurrency(netWorth, currency)}
              </h2>
              <div className="flex items-center gap-1 text-sm">
                <div
                  className={cn(
                    "flex items-center gap-1",
                    change.absoluteChange >= 0
                      ? "text-green-500"
                      : "text-red-500",
                  )}
                >
                  {change.absoluteChange >= 0 ? (
                    <TrendingUp className="size-4" />
                  ) : (
                    <TrendingDown className="size-4" />
                  )}
                  <span>
                    {change.absoluteChange >= 0 ? "+" : ""}
                    {formatNumber(Math.abs(change.absoluteChange), undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    ({change.percentageChange >= 0 ? "+" : ""}
                    {change.percentageChange.toFixed(2)}%)
                  </span>
                </div>
                <span className="text-muted-foreground">vs last period</span>
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
        className={cn("flex-1 transition-opacity", isLoading && "opacity-50")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
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
              cursorStyle={{
                stroke: "var(--border)",
                strokeWidth: 1,
              }}
            />
            <Line
              dataKey="value"
              stroke="var(--chart-0)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4.5,
                strokeWidth: 2.5,
                filter: "drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.3))",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
