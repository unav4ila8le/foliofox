"use client";

import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompactNumber, formatCurrency } from "@/lib/number-format";

const data = [
  { date: new Date("2025-09-01"), income: 1000 },
  { date: new Date("2025-10-01"), income: 1200 },
  { date: new Date("2025-11-01"), income: 1500 },
  { date: new Date("2025-12-01"), income: 1300 },
  { date: new Date("2026-01-01"), income: 1400 },
  { date: new Date("2026-02-01"), income: 1500 },
  { date: new Date("2026-03-01"), income: 1600 },
  { date: new Date("2026-04-01"), income: 1700 },
  { date: new Date("2026-05-01"), income: 1800 },
  { date: new Date("2026-06-01"), income: 1900 },
  { date: new Date("2026-07-01"), income: 2000 },
];

export function ProjectedIncomeBarChart({
  currency = "USD",
}: {
  currency: string;
}) {
  // Format date for display on X-axis
  const formatXAxisDate = (date: Date) => {
    return format(date, "MMM yy");
  };

  // Format value for display on Y-axis
  const formatYAxisValue = (value: number) => {
    return formatCompactNumber(value);
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis
          dataKey="date"
          tickFormatter={formatXAxisDate}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          dy={5}
        />
        <YAxis
          dataKey="income"
          tickFormatter={formatYAxisValue}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          width={28}
        />
        <CartesianGrid stroke="var(--border)" vertical={false} />
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
          cursor={{ fill: "var(--accent)", opacity: 0.7 }}
        />
        <Bar dataKey="income" fill="var(--chart-3)" maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
