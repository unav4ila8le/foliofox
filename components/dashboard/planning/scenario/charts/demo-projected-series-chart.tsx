"use client";

import React from "react";
import type { ScenarioInitialValueBasis } from "@/lib/planning/initial-value-basis";
import {
  runScenario,
  makeRecurring,
  makeOneOff,
  type Scenario,
} from "@/lib/planning/scenario/engine";
import { addYears } from "date-fns";
import { fromJSDate, ld } from "@/lib/date/date-utils";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonthYear } from "@/lib/date/date-format";
import { formatCompactNumber } from "@/lib/number-format";
import { computeProjectedSeriesYAxisDomain } from "@/lib/planning/scenario/chart-utils";
import { useLocale } from "@/hooks/use-locale";

// Demo scenario with realistic events showing growth and drops
const DEMO_SCENARIO: Scenario = {
  name: "Demo",
  events: [
    // Monthly salary
    makeRecurring({
      name: "💶 Salary",
      type: "income",
      amount: 3500,
      startDate: ld(2025, 1, 1),
      endDate: null,
      frequency: "monthly",
    }),
    // Monthly rent
    makeRecurring({
      name: "🏠 Rent",
      type: "expense",
      amount: 1200,
      startDate: ld(2025, 1, 1),
      endDate: null,
      frequency: "monthly",
    }),
    // Monthly living costs
    makeRecurring({
      name: "🍕 Living Costs",
      type: "expense",
      amount: 900,
      startDate: ld(2025, 1, 1),
      endDate: null,
      frequency: "monthly",
    }),
    // Yearly bonus
    makeRecurring({
      name: "💰 Yearly Bonus",
      type: "income",
      amount: 6000,
      startDate: ld(2025, 12, 1),
      endDate: null,
      frequency: "yearly",
    }),
    // Big expense: Car purchase
    makeOneOff({
      name: "🚗 Car Purchase",
      type: "expense",
      amount: 15000,
      date: ld(2025, 3, 15),
    }),
    // Big expense: Vacation
    makeOneOff({
      name: "✈️ Summer Vacation",
      type: "expense",
      amount: 3500,
      date: ld(2025, 7, 1),
    }),
    // Home improvement
    makeOneOff({
      name: "🔨 Home Renovation",
      type: "expense",
      amount: 8000,
      date: ld(2026, 4, 1),
    }),
    // Freelance income
    makeRecurring({
      name: "💻 Freelance",
      type: "income",
      amount: 800,
      startDate: ld(2025, 6, 1),
      endDate: ld(2027, 12, 31),
      frequency: "monthly",
    }),
    // Emergency expense
    makeOneOff({
      name: "🏥 Medical Emergency",
      type: "expense",
      amount: 2500,
      date: ld(2027, 2, 1),
    }),
    // Big purchase
    makeOneOff({
      name: "Big expense",
      type: "expense",
      amount: 15000,
      date: ld(2030, 2, 1),
    }),
  ],
};

export function DemoProjectedSeriesChart({
  initialValue,
  initialValueBasis,
}: {
  initialValue: number;
  initialValueBasis: ScenarioInitialValueBasis;
}) {
  const locale = useLocale();
  const endDate = React.useMemo(() => {
    return addYears(new Date(), 5);
  }, []);

  const scenarioResult = React.useMemo(() => {
    return runScenario({
      scenario: DEMO_SCENARIO,
      initialValue,
      initialValueBasis,
      startDate: fromJSDate(new Date()),
      endDate: fromJSDate(endDate),
    });
  }, [initialValue, initialValueBasis, endDate]);

  const chartData = React.useMemo(() => {
    const sortedMonths = Object.keys(scenarioResult.projectedSeries).sort();

    const data: Array<{
      monthKey: string;
      timestamp: number;
      date: Date;
      projectedValue: number;
    }> = [];

    sortedMonths.forEach((monthKey) => {
      const [yearStr, monthStr] = monthKey.split("-");
      const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);

      data.push({
        monthKey,
        timestamp: date.getTime(),
        date,
        projectedValue: scenarioResult.projectedSeries[monthKey],
      });
    });

    return data;
  }, [scenarioResult]);

  const yAxisDomain = React.useMemo(() => {
    return computeProjectedSeriesYAxisDomain(
      chartData.map((point) => point.projectedValue),
    );
  }, [chartData]);

  const isPositiveTrend = React.useMemo(() => {
    if (chartData.length === 0) return true;

    const firstProjectedValue = chartData.at(0)?.projectedValue || 0;
    const lastProjectedValue = chartData.at(-1)?.projectedValue || 0;

    return lastProjectedValue >= firstProjectedValue;
  }, [chartData]);

  const chartColor = isPositiveTrend
    ? "oklch(0.72 0.19 150)"
    : "oklch(0.64 0.21 25)";

  const formatXAxisDate = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";

    return formatMonthYear(date, { locale, month: "short", year: "2-digit" });
  };

  const formatYAxisValue = (value: number) => {
    return formatCompactNumber(value, { locale });
  };

  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      initialDimension={{ width: 256, height: 128 }}
    >
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="demoGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <YAxis
          dataKey="projectedValue"
          tickFormatter={formatYAxisValue}
          axisLine={false}
          tickLine={false}
          tick={{
            fontSize: 12,
            fill: "var(--muted-foreground)",
          }}
          domain={yAxisDomain}
          width="auto"
        />
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={["dataMin", "dataMax"]}
          axisLine={false}
          tickLine={false}
          tick={{
            fontSize: 12,
            fill: "var(--muted-foreground)",
          }}
          tickFormatter={formatXAxisDate}
          scale="time"
          minTickGap={30}
        />
        <Area
          dataKey="projectedValue"
          stroke={chartColor}
          strokeWidth={1.5}
          fill="url(#demoGradient)"
          fillOpacity={1}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
