"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

import { formatPercentage, formatCurrency } from "@/lib/number-format";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";

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
  const locale = useLocale();
  const stats = useMemo(
    () => calculateStats(scenarioResult, initialBalance, finalBalance),
    [scenarioResult, initialBalance, finalBalance],
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Net Change */}
      <Card className="rounded-md shadow-xs">
        <CardHeader>
          <CardDescription>Net Change</CardDescription>
          <CardTitle
            className={cn(
              "flex items-center gap-2 whitespace-nowrap",
              stats.netChange >= 0 ? "text-green-600" : "text-red-600",
            )}
          >
            <span>
              {stats.netChange >= 0 ? "+" : ""}
              {formatCurrency(stats.netChange, currency, { locale })}
            </span>
            {stats.netChange >= 0 ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
          </CardTitle>
          <p
            className={cn(
              "text-xs",
              stats.netChangePercentage >= 0
                ? "text-green-600"
                : "text-red-600",
            )}
          >
            {stats.netChange >= 0 ? "+" : ""}
            {initialBalance === 0
              ? "N/A%"
              : formatPercentage(stats.netChangePercentage / 100, { locale })}
          </p>
        </CardHeader>
      </Card>

      {/* Lowest Balance */}
      <Card className="rounded-md shadow-xs">
        <CardHeader>
          <CardDescription className="flex items-center gap-1">
            Lowest Balance
          </CardDescription>
          <CardTitle
            className={cn(
              "flex items-center gap-2",
              stats.lowestBalance < 0
                ? "text-red-600"
                : stats.isLowestBelowInitial
                  ? "text-yellow-600"
                  : undefined,
            )}
          >
            {formatCurrency(stats.lowestBalance, currency, { locale })}
            {stats.isLowestBelowInitial && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="size-4" />
                </TooltipTrigger>
                <TooltipContent>
                  The lowest balance is below the initial balance
                </TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {format(stats.lowestBalanceDate, "MMM yyyy")}
          </p>
        </CardHeader>
      </Card>

      {/* Avg Monthly Change */}
      <Card className="rounded-md shadow-xs">
        <CardHeader>
          <CardDescription>Avg. Monthly Change</CardDescription>
          <CardTitle
            className={cn(
              "flex items-center gap-2",
              stats.avgMonthlyChange >= 0 ? "text-green-600" : "text-red-600",
            )}
          >
            {stats.avgMonthlyChange >= 0 ? "+" : ""}
            {formatCurrency(stats.avgMonthlyChange, currency, { locale })}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Over {stats.monthCount} months
          </p>
        </CardHeader>
      </Card>

      {/* Final Balance */}
      <Card className="rounded-md shadow-xs">
        <CardHeader>
          <CardDescription>Final Balance</CardDescription>
          <CardTitle
            className={cn(
              "flex items-center gap-2",
              finalBalance >= initialBalance
                ? "text-green-600"
                : "text-yellow-600",
            )}
          >
            {formatCurrency(finalBalance, currency, { locale })}
            {finalBalance < initialBalance && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="size-4" />
                </TooltipTrigger>
                <TooltipContent>
                  The final balance is below the initial balance
                </TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {format(endDate, "MMM yyyy")}
          </p>
        </CardHeader>
      </Card>
    </div>
  );
};
