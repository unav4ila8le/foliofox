"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
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

import { formatCurrency } from "@/lib/number/format";

// Sample data structure for our weekly net worth data
interface NetWorthData {
  date: string; // ISO date string like "2024-01-01"
  value: number; // Net worth value
}

// Mock data for now - we'll replace this with real data later
const mockData: NetWorthData[] = [
  { date: "2024-01-01", value: 150000 },
  { date: "2024-01-08", value: 152000 },
  { date: "2024-01-15", value: 148000 },
  { date: "2024-01-22", value: 155000 },
  { date: "2024-01-29", value: 158000 },
  { date: "2024-02-05", value: 160000 },
  { date: "2024-02-12", value: 157000 },
  { date: "2024-02-19", value: 162000 },
  { date: "2024-02-26", value: 165000 },
];

export function NetWorthLineChartRecharts({
  netWorth,
  currency,
}: {
  netWorth: number;
  currency: string;
}) {
  // Format date for display on X-axis
  const formatXAxisDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
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
          <LineChart data={mockData}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisDate}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              domain={[
                (dataMin: number) => dataMin * 0.95,
                (dataMax: number) => dataMax * 1.05,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--chart-0)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
