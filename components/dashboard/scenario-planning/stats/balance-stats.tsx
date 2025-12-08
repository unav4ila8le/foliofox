import React from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/number-format";

// Colors matching balance-chart.tsx
const POSITIVE_COLOR = "oklch(0.72 0.19 150)"; // green
const NEGATIVE_COLOR = "oklch(0.64 0.21 25)"; // red

interface CashflowEntry {
  amount: number;
  events: Array<{
    name: string;
    type: "income" | "expense";
    amount: number;
  }>;
}

interface BalanceStatsProps {
  initialBalance: number;
  finalBalance: number;
  currency: string;
  scenarioResult: {
    balance: Record<string, number>;
    cashflow: Record<string, CashflowEntry>;
  };
  startDate: Date;
  endDate: Date;
}

const calculateStats = (
  scenarioResult: BalanceStatsProps["scenarioResult"],
  initialBalance: number,
  finalBalance: number,
) => {
  // 1. Net Change calculations
  const netChange = finalBalance - initialBalance;
  const netChangePercentage =
    initialBalance !== 0 ? (netChange / initialBalance) * 100 : 0;

  // 2. Lowest Balance calculations
  const balanceEntries = Object.entries(scenarioResult.balance);
  const lowestEntry = balanceEntries.reduce(
    (min, [monthKey, balance]) =>
      balance < min.balance ? { monthKey, balance } : min,
    { monthKey: "", balance: initialBalance },
  );

  // Parse monthKey "YYYY-MM" to date
  const lowestDate = lowestEntry.monthKey
    ? (() => {
        const [year, month] = lowestEntry.monthKey.split("-");
        return new Date(parseInt(year), parseInt(month) - 1);
      })()
    : new Date();

  // 3. Average Monthly Change
  const monthCount = Object.keys(scenarioResult.balance).length;
  const avgMonthlyChange = monthCount > 0 ? netChange / monthCount : 0;

  return {
    netChange,
    netChangePercentage,
    lowestBalance: lowestEntry.balance,
    lowestBalanceDate: lowestDate,
    isLowestBelowInitial: lowestEntry.balance < initialBalance,
    avgMonthlyChange,
    monthCount,
  };
};

export const BalanceStats = ({
  initialBalance,
  finalBalance,
  currency,
  scenarioResult,
  endDate,
}: BalanceStatsProps) => {
  const stats = React.useMemo(
    () => calculateStats(scenarioResult, initialBalance, finalBalance),
    [scenarioResult, initialBalance, finalBalance],
  );

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Net Change</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <span
              style={{
                color: stats.netChange >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
              }}
            >
              {stats.netChange >= 0 ? "+" : ""}
              {formatCurrency(stats.netChange, currency)}
            </span>
            {stats.netChange >= 0 ? (
              <TrendingUp
                className="size-5"
                style={{ color: POSITIVE_COLOR }}
              />
            ) : (
              <TrendingDown
                className="size-5"
                style={{ color: NEGATIVE_COLOR }}
              />
            )}
          </CardTitle>
          <p
            className="text-xs"
            style={{
              color: stats.netChange >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
            }}
          >
            {stats.netChange >= 0 ? "+" : ""}
            {formatPercentage(stats.netChangePercentage / 100, 2)}
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription className="flex items-center gap-1">
            Lowest Balance
            {stats.isLowestBelowInitial && (
              <AlertTriangle
                className="size-3"
                style={{ color: NEGATIVE_COLOR }}
              />
            )}
          </CardDescription>
          <CardTitle
            className="text-2xl"
            style={{
              color: stats.isLowestBelowInitial ? NEGATIVE_COLOR : undefined,
            }}
          >
            {formatCurrency(stats.lowestBalance, currency)}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {stats.lowestBalanceDate.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Avg Monthly Change</CardDescription>
          <CardTitle
            className="text-2xl"
            style={{
              color:
                stats.avgMonthlyChange >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
            }}
          >
            {stats.avgMonthlyChange >= 0 ? "+" : ""}
            {formatCurrency(stats.avgMonthlyChange, currency)}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Over {stats.monthCount} months
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Final Balance</CardDescription>
          <CardTitle
            className="text-2xl"
            style={{
              color:
                finalBalance >= initialBalance
                  ? POSITIVE_COLOR
                  : NEGATIVE_COLOR,
            }}
          >
            {formatCurrency(finalBalance, currency)}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {endDate.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </p>
        </CardHeader>
      </Card>
    </div>
  );
};
