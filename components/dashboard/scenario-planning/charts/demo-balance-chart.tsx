"use client";

import React from "react";
import {
  runScenario,
  makeRecurring,
  makeOneOff,
  type Scenario,
} from "@/lib/scenario-planning";
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

export function DemoBalanceChart({
  initialBalance,
}: {
  initialBalance: number;
}) {
  const locale = useLocale();
  const endDate = React.useMemo(() => {
    return addYears(new Date(), 5);
  }, []);

  const { scenarioResult } = React.useMemo(() => {
    const scenarioResult = runScenario({
      scenario: DEMO_SCENARIO,
      initialBalance,
      startDate: fromJSDate(new Date()),
      endDate: fromJSDate(endDate),
    });

    return {
      scenarioResult,
    };
  }, [initialBalance, endDate]);

  const chartData = React.useMemo(() => {
    const sortedMonths = Object.keys(scenarioResult.balance).sort();

    const data: Array<{
      monthKey: string;
      timestamp: number;
      date: Date;
      balance: number;
    }> = [];

    sortedMonths.forEach((monthKey) => {
      const [yearStr, monthStr] = monthKey.split("-");
      const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);

      data.push({
        monthKey,
        timestamp: date.getTime(),
        date,
        balance: scenarioResult.balance[monthKey],
      });
    });

    return data;
  }, [scenarioResult]);

  const yAxisDomain = React.useMemo(() => {
    if (chartData.length === 0) return ["auto", "auto"] as const;

    const balances = chartData.map((d) => d.balance);
    const minBalance = Math.min(...balances);
    const maxBalance = Math.max(...balances);

    const range = maxBalance - minBalance;
    const padding = range * 0.2;

    if (range === 0) {
      const fixedPadding = Math.abs(minBalance) * 0.2 || 1000;
      return [minBalance - fixedPadding, maxBalance + fixedPadding] as const;
    }

    return [minBalance - padding, maxBalance + padding] as const;
  }, [chartData]);

  const isPositiveTrend = React.useMemo(() => {
    if (chartData.length === 0) return true;

    const firstBalance = chartData.at(0)?.balance || 0;
    const lastBalance = chartData.at(-1)?.balance || 0;

    return lastBalance >= firstBalance;
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
          dataKey="balance"
          tickFormatter={formatYAxisValue}
          axisLine={false}
          tickLine={false}
          tick={{
            fontSize: 12,
            fill: "var(--muted-foreground)",
          }}
          domain={yAxisDomain}
          width={40}
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
          dataKey="balance"
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
