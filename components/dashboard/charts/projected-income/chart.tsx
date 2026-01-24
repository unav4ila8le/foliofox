"use client";

import {
  ResponsiveContainer,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMonthYear } from "@/lib/date/date-format";
import { formatCompactNumber, formatCurrency } from "@/lib/number-format";
import { useLocale } from "@/hooks/use-locale";

import type { ProjectedIncomeData } from "@/types/global.types";

interface ProjectedIncomeBarChartProps {
  data: ProjectedIncomeData[];
  currency: string;
}

export function ProjectedIncomeBarChart({
  data,
  currency,
}: ProjectedIncomeBarChartProps) {
  const locale = useLocale();
  // Format date for display on X-axis
  const formatXAxisDate = (date: Date) => {
    return formatMonthYear(date, { locale, month: "short", year: "2-digit" });
  };

  // Format value for display on Y-axis
  const formatYAxisValue = (value: number) => {
    return formatCompactNumber(value, { locale });
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
                  {formatMonthYear(data.payload.date, {
                    locale,
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="text-sm">
                  {formatCurrency(Number(data.value), currency, { locale })}
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
