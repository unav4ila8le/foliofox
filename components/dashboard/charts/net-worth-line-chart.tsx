"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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

const chartData = [
  { date: "2023-01-01", netWorth: 986500 },
  { date: "2023-02-01", netWorth: 998200 },
  { date: "2023-03-01", netWorth: 992400 },
  { date: "2023-04-01", netWorth: 1015600 },
  { date: "2023-05-01", netWorth: 1008900 },
  { date: "2023-06-01", netWorth: 1052000 },
  { date: "2023-07-01", netWorth: 1048500 },
  { date: "2023-08-01", netWorth: 1035400 },
  { date: "2023-09-01", netWorth: 1064200 },
  { date: "2023-10-01", netWorth: 1052600 },
  { date: "2023-11-01", netWorth: 1081500 },
  { date: "2023-12-01", netWorth: 1110000 },
];

const chartConfig = {
  netWorth: {
    label: "Net Worth",
    color: "var(--chart-0)",
  },
} satisfies ChartConfig;

export function NetWorthLineChart() {
  // Calculate the domain with a 10% padding
  const minValue = Math.min(...chartData.map((d) => d.netWorth));
  const maxValue = Math.max(...chartData.map((d) => d.netWorth));
  const padding = (maxValue - minValue) * 0.1;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Net Worth</CardDescription>
        <h2 className="text-xl font-semibold">
          {formatCurrency(chartData[chartData.length - 1].netWorth, "EUR")}
        </h2>
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
