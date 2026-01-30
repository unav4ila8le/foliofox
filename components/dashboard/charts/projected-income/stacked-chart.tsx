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

import type {
  ProjectedIncomeStackedMonth,
  ProjectedIncomeStackedSeries,
} from "@/server/analysis/projected-income/projected-income";

const COLORS = [
  "var(--chart-0)",
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface ProjectedIncomeStackedBarChartProps {
  data: ProjectedIncomeStackedMonth[];
  series: ProjectedIncomeStackedSeries[];
  currency: string;
}

export function ProjectedIncomeStackedBarChart({
  data,
  series,
  currency,
}: ProjectedIncomeStackedBarChartProps) {
  const locale = useLocale();

  const chartData = data.map((row) => ({
    date: row.date,
    total: row.total,
    ...row.values,
  }));

  // Format date for display on X-axis
  const formatXAxisDate = (date: Date) => {
    return formatMonthYear(date, { locale, month: "short", year: "2-digit" });
  };

  // Format value for display on Y-axis
  const formatYAxisValue = (value: number) => {
    return formatCompactNumber(value, { locale });
  };

  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      initialDimension={{ width: 256, height: 128 }}
    >
      <BarChart data={chartData}>
        <XAxis
          dataKey="date"
          tickFormatter={formatXAxisDate}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          dy={5}
        />
        <YAxis
          dataKey="total"
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

            const first = payload[0];
            const payloadRows = payload
              .filter(
                (item) => typeof item.value === "number" && item.value !== 0,
              )
              .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

            return (
              <div className="bg-background border-border flex flex-col gap-1 rounded-md border px-2.5 py-1.5">
                <span className="text-muted-foreground text-xs">
                  {formatMonthYear(first.payload.date, {
                    locale,
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(Number(first.payload.total), currency, {
                    locale,
                  })}
                </span>
                {payloadRows.map((item) => (
                  <div
                    key={item.dataKey}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-muted-foreground max-w-32 truncate">
                      {series.find((entry) => entry.key === item.dataKey)
                        ?.name ?? item.dataKey}
                    </span>
                    <span className="text-foreground text-end font-medium">
                      {formatCurrency(Number(item.value), currency, {
                        locale,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
          cursor={{ fill: "var(--accent)", opacity: 0.7 }}
        />
        {series.map((entry, index) => (
          <Bar
            key={entry.key}
            dataKey={entry.key}
            stackId="income"
            fill={COLORS[index % COLORS.length]}
            maxBarSize={24}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
