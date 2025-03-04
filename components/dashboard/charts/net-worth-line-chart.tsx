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
  // 2024 data
  { date: "2024-01-01", netWorth: 1125000 },
  { date: "2024-02-01", netWorth: 1142300 },
  { date: "2024-03-01", netWorth: 1156800 },
  { date: "2024-04-01", netWorth: 1178500 },
  { date: "2024-05-01", netWorth: 1195200 },
  { date: "2024-06-01", netWorth: 1210000 },
  { date: "2024-07-01", netWorth: 1228400 },
  { date: "2024-08-01", netWorth: 1245000 },
  { date: "2024-09-01", netWorth: 1267300 },
  { date: "2024-10-01", netWorth: 1289000 },
  { date: "2024-11-01", netWorth: 1310000 },
  { date: "2024-12-01", netWorth: 1332000 },
  // 2025 data
  { date: "2025-01-01", netWorth: 1350000 },
  { date: "2025-02-01", netWorth: 1370000 },
  { date: "2025-02-15", netWorth: 1345000 },
  { date: "2025-03-01", netWorth: 1390000 },
];

const chartConfig = {
  netWorth: {
    label: "Net Worth",
    color: "var(--chart-0)",
  },
} satisfies ChartConfig;

export function NetWorthLineChart() {
  // State for the selected time period, default to 3 months
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("3-months");
  // State for the filtered data
  const [chartData, setChartData] = useState<ChartDataEntry[]>([]);

  // Filter data based on selected time period
  useEffect(() => {
    const filteredData = filterDataByTimePeriod(allChartData, timePeriod);
    setChartData(filteredData);
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
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", { month: "short" });
              }}
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
