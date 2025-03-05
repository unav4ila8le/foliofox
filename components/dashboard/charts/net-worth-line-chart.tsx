"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { formatCurrency } from "@/lib/number";
import { TimePeriod, filterDataByTimePeriod } from "@/lib/filters/time-period";
import { WeeklyNetWorth, weeklyNetWorth } from "@/mocks/financial/net-worth";

const chartConfig = {
  netWorth: {
    label: "Net Worth",
    color: "var(--chart-0)",
  },
} satisfies ChartConfig;

// Helper function to determine if we should use weekly ticks
const shouldUseWeeklyTicks = (period: TimePeriod) => {
  if (period === "1-month" || period === "3-months") return true;
  if (period === "ytd") {
    const currentMonth = new Date().getMonth(); // 0-11
    return currentMonth < 3; // Q1
  }
  return false;
};

// Helper function to format tick labels based on time period
const formatTick = (date: string, period: TimePeriod) => {
  const dateObj = new Date(date);
  if (period === "5-years") {
    return dateObj.getFullYear().toString();
  }
  if (shouldUseWeeklyTicks(period)) {
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
};

// Helper function to filter data points based on time period
// For longer periods, we don't need to show every weekly data point
const filterDataPointsByPeriod = (
  data: WeeklyNetWorth[],
  period: TimePeriod,
): WeeklyNetWorth[] => {
  if (shouldUseWeeklyTicks(period)) {
    // For weekly views, show all data points
    return data;
  } else if (period === "5-years") {
    // For 5-year view, show only the last data point of each month
    const monthlyData: WeeklyNetWorth[] = [];
    let currentMonth = -1;
    let lastEntryOfMonth: WeeklyNetWorth | null = null;

    // Group by month and keep only the last entry of each month
    data.forEach((entry) => {
      const date = new Date(entry.date);
      const month = date.getMonth() + date.getFullYear() * 12; // Unique identifier for each month

      if (month !== currentMonth) {
        if (lastEntryOfMonth) {
          monthlyData.push(lastEntryOfMonth);
        }
        currentMonth = month;
      }
      lastEntryOfMonth = entry;
    });

    // Add the last entry
    if (lastEntryOfMonth) {
      monthlyData.push(lastEntryOfMonth);
    }

    return monthlyData;
  } else {
    // For 6-month and 1-year views, show only the first data point of each month
    const monthlyData: WeeklyNetWorth[] = [];
    let currentMonth = -1;

    // Group by month and keep only the first entry of each month
    data.forEach((entry) => {
      const date = new Date(entry.date);
      const month = date.getMonth() + date.getFullYear() * 12; // Unique identifier for each month

      if (month !== currentMonth) {
        monthlyData.push(entry);
        currentMonth = month;
      }
    });

    return monthlyData;
  }
};

export function NetWorthLineChart() {
  // State for the selected time period, default to 6 months
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("6-months");
  // State for the filtered data
  const [chartData, setChartData] = useState<WeeklyNetWorth[]>([]);

  // Filter data based on selected time period
  useEffect(() => {
    const filteredByTime = filterDataByTimePeriod(weeklyNetWorth, timePeriod);
    const filteredByDataPoints = filterDataPointsByPeriod(
      filteredByTime,
      timePeriod,
    );
    setChartData(filteredByDataPoints);
  }, [timePeriod]);

  // Calculate the Y axis domain with a 10% padding
  const minValue =
    chartData.length > 0 ? Math.min(...chartData.map((d) => d.netWorth)) : 0;
  const maxValue =
    chartData.length > 0 ? Math.max(...chartData.map((d) => d.netWorth)) : 0;
  const padding = (maxValue - minValue) * 0.1;

  // Get the most recent net worth value
  const currentNetWorth =
    chartData.length > 0 ? chartData[chartData.length - 1].netWorth : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between gap-4">
          <div>
            <CardDescription>Net Worth</CardDescription>
            <h2 className="text-xl font-semibold">
              {formatCurrency(currentNetWorth, "USD")}
            </h2>
          </div>
          <Select
            value={timePeriod}
            onValueChange={(value: TimePeriod) => setTimePeriod(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="1-month">1 Month</SelectItem>
              <SelectItem value="3-months">3 Months</SelectItem>
              <SelectItem value="6-months">6 Months</SelectItem>
              <SelectItem value="ytd">YTD</SelectItem>
              <SelectItem value="1-year">1 Year</SelectItem>
              <SelectItem value="5-years">5 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <YAxis domain={[minValue - padding, maxValue + padding]} hide />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              tickFormatter={(value) => formatTick(value, timePeriod)}
            />
            <ChartTooltip
              cursor={false}
              labelClassName="text-xs text-muted-foreground"
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                  formatter={(value) =>
                    typeof value === "number"
                      ? formatCurrency(value, "USD")
                      : value
                  }
                />
              }
            />
            <Line
              dataKey="netWorth"
              type="linear"
              stroke="var(--color-netWorth)"
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
