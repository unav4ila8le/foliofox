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

// Define the data type for chart entries
type ChartDataEntry = {
  date: string;
  netWorth: number;
};

// Extended mock data to include 2024
const allChartData: ChartDataEntry[] = [
  // January 2024
  { date: "2024-01-01", netWorth: 1125000 },
  { date: "2024-01-08", netWorth: 1128400 },
  { date: "2024-01-15", netWorth: 1122900 },
  { date: "2024-01-22", netWorth: 1127600 },
  { date: "2024-01-29", netWorth: 1131200 },

  // February 2024
  { date: "2024-02-05", netWorth: 1128900 },
  { date: "2024-02-12", netWorth: 1134500 },
  { date: "2024-02-19", netWorth: 1139200 },
  { date: "2024-02-26", netWorth: 1142300 },

  // March 2024
  { date: "2024-03-04", netWorth: 1145800 },
  { date: "2024-03-11", netWorth: 1149200 },
  { date: "2024-03-18", netWorth: 1147600 },
  { date: "2024-03-25", netWorth: 1152300 },

  // April 2024
  { date: "2024-04-01", netWorth: 1156800 },
  { date: "2024-04-08", netWorth: 1159300 },
  { date: "2024-04-15", netWorth: 1164500 },
  { date: "2024-04-22", netWorth: 1168900 },
  { date: "2024-04-29", netWorth: 1172400 },

  // May 2024
  { date: "2024-05-06", netWorth: 1176800 },
  { date: "2024-05-13", netWorth: 1181200 },
  { date: "2024-05-20", netWorth: 1185600 },
  { date: "2024-05-27", netWorth: 1189200 },

  // June 2024
  { date: "2024-06-03", netWorth: 1184500 },
  { date: "2024-06-10", netWorth: 1179800 },
  { date: "2024-06-17", netWorth: 1173500 },
  { date: "2024-06-24", netWorth: 1167500 },

  // July 2024
  { date: "2024-07-01", netWorth: 1172300 },
  { date: "2024-07-08", netWorth: 1176800 },
  { date: "2024-07-15", netWorth: 1181400 },
  { date: "2024-07-22", netWorth: 1185900 },
  { date: "2024-07-29", netWorth: 1189500 },

  // August 2024
  { date: "2024-08-05", netWorth: 1192800 },
  { date: "2024-08-12", netWorth: 1195600 },
  { date: "2024-08-19", netWorth: 1193400 },
  { date: "2024-08-26", netWorth: 1196800 },

  // September 2024
  { date: "2024-09-02", netWorth: 1192400 },
  { date: "2024-09-09", netWorth: 1187400 },
  { date: "2024-09-16", netWorth: 1191800 },
  { date: "2024-09-23", netWorth: 1195200 },
  { date: "2024-09-30", netWorth: 1198600 },

  // October 2024
  { date: "2024-10-07", netWorth: 1203200 },
  { date: "2024-10-14", netWorth: 1207800 },
  { date: "2024-10-21", netWorth: 1210800 },
  { date: "2024-10-28", netWorth: 1215400 },

  // November 2024
  { date: "2024-11-04", netWorth: 1221900 },
  { date: "2024-11-11", netWorth: 1228400 },
  { date: "2024-11-18", netWorth: 1235900 },
  { date: "2024-11-25", netWorth: 1245900 },

  // December 2024
  { date: "2024-12-02", netWorth: 1242400 },
  { date: "2024-12-09", netWorth: 1238400 },
  { date: "2024-12-16", netWorth: 1241800 },
  { date: "2024-12-23", netWorth: 1245200 },
  { date: "2024-12-30", netWorth: 1248600 },

  // January 2025
  { date: "2025-01-06", netWorth: 1252100 },
  { date: "2025-01-13", netWorth: 1256700 },
  { date: "2025-01-20", netWorth: 1253200 },
  { date: "2025-01-27", netWorth: 1249800 },

  // February 2025
  { date: "2025-02-03", netWorth: 1245400 },
  { date: "2025-02-10", netWorth: 1239800 },
  { date: "2025-02-17", netWorth: 1234500 },
  { date: "2025-02-24", netWorth: 1241900 },

  // March 2025
  { date: "2025-03-03", netWorth: 1248400 },
];

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
  data: ChartDataEntry[],
  period: TimePeriod,
): ChartDataEntry[] => {
  if (shouldUseWeeklyTicks(period)) {
    // For weekly views, show all data points
    return data;
  } else if (period === "5-years") {
    // For 5-year view, show only the last data point of each month
    const monthlyData: ChartDataEntry[] = [];
    let currentMonth = -1;
    let lastEntryOfMonth: ChartDataEntry | null = null;

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
    const monthlyData: ChartDataEntry[] = [];
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
  // State for the selected time period, default to 3 months
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("3-months");
  // State for the filtered data
  const [chartData, setChartData] = useState<ChartDataEntry[]>([]);

  // Filter data based on selected time period
  useEffect(() => {
    const filteredByTime = filterDataByTimePeriod(allChartData, timePeriod);
    const filteredByDataPoints = filterDataPointsByPeriod(
      filteredByTime,
      timePeriod,
    );
    setChartData(filteredByDataPoints);
  }, [timePeriod]);

  // Calculate the domain with a 10% padding
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
              {formatCurrency(currentNetWorth, "EUR")}
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
        <ChartContainer config={chartConfig} className="h-40 w-full">
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
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    typeof value === "number"
                      ? formatCurrency(value, "EUR")
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
