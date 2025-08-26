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

import type { ProjectedIncomeData } from "@/types/global.types";

interface ProjectedIncomeBarChartProps {
  data: ProjectedIncomeData[];
  currency: string;
}

export function ProjectedIncomeBarChart({
  data,
  currency,
}: ProjectedIncomeBarChartProps) {
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
                  {format(data.payload.date, "MMMM yyyy")}
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
