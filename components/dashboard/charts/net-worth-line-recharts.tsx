"use client";

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

import { formatCompactNumber, formatCurrency } from "@/lib/number/format";

// Sample data structure for our weekly net worth data
interface NetWorthData {
  date: Date;
  value: number;
}

// // Mock data for now - we'll replace this with real data later
// const mockData: NetWorthData[] = [
//   { date: "2024-01-01", value: 150000 },
//   { date: "2024-01-08", value: 152000 },
//   { date: "2024-01-15", value: 148000 },
//   { date: "2024-01-22", value: 155000 },
//   { date: "2024-01-29", value: 158000 },
//   { date: "2024-02-05", value: 160000 },
//   { date: "2024-02-12", value: 157000 },
//   { date: "2024-02-19", value: 162000 },
//   { date: "2024-02-26", value: 165000 },
// ];

export function NetWorthLineChartRecharts({
  currency,
  netWorth,
  history,
}: {
  currency: string;
  netWorth: number;
  history: NetWorthData[];
}) {
  // Format date for display on X-axis
  const formatXAxisDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Format value for display on Y-axis
  const formatYAxisValue = (value: number) => {
    return formatCompactNumber(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between gap-4">
          <div>
            <CardDescription>Net Worth</CardDescription>
            <h2 className="text-xl font-semibold">
              {formatCurrency(netWorth, currency)}
            </h2>
          </div>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="6 Months" />
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
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <YAxis
              dataKey="value"
              tickFormatter={formatYAxisValue}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              domain={[
                (dataMin: number) => dataMin * 0.95,
                (dataMax: number) => dataMax * 1.05,
              ]}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisDate}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const data = payload[0];
                return (
                  <div className="bg-background border-border flex flex-col gap-1 rounded-md border px-2.5 py-1.5">
                    <span className="text-muted-foreground text-xs">
                      {new Date(data.payload.date).toLocaleDateString()}
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
