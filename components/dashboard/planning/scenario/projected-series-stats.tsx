"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

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

import type { ScenarioInitialValueBasis } from "@/lib/planning/initial-value-basis";
import {
  getAverageProjectedSeriesChangeLabel,
  getFinalProjectedSeriesLabel,
  getLowestProjectedSeriesLabel,
  getProjectedNetChangeLabel,
  getProjectedSeriesLabel,
} from "@/lib/planning/scenario/projected-series";
import type { CashflowEntry } from "@/lib/planning/scenario/engine";
import { formatMonthYear } from "@/lib/date/date-format";
import { formatPercentage, formatCurrency } from "@/lib/number-format";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";

interface ProjectedSeriesStatsProps {
  initialValue: number;
  initialValueBasis: ScenarioInitialValueBasis;
  finalProjectedValue: number;
  currency: string;
  scenarioResult: {
    projectedSeries: Record<string, number>;
    cashflow: Record<string, CashflowEntry>;
  };
  endDate: Date;
}

const calculateProjectedSeriesStats = (
  scenarioResult: ProjectedSeriesStatsProps["scenarioResult"],
  initialValue: number,
  finalProjectedValue: number,
) => {
  // 1. Net Change calculations
  const netChange = finalProjectedValue - initialValue;
  const netChangePercentage =
    initialValue !== 0 ? (netChange / initialValue) * 100 : 0;

  // 2. Lowest projected value calculations
  const projectedSeriesEntries = Object.entries(scenarioResult.projectedSeries);
  const lowestEntry = projectedSeriesEntries.reduce(
    (min, [monthKey, projectedValue]) =>
      projectedValue < min.projectedValue ? { monthKey, projectedValue } : min,
    { monthKey: "", projectedValue: initialValue },
  );

  // Parse monthKey "YYYY-MM" to date
  const lowestDate = lowestEntry.monthKey
    ? (() => {
        const [year, month] = lowestEntry.monthKey.split("-");
        return new Date(parseInt(year), parseInt(month) - 1);
      })()
    : new Date();

  // 3. Average Monthly Change
  const monthCount = Object.keys(scenarioResult.projectedSeries).length;
  const avgMonthlyChange = monthCount > 0 ? netChange / monthCount : 0;

  return {
    netChange,
    netChangePercentage,
    lowestProjectedValue: lowestEntry.projectedValue,
    lowestProjectedValueDate: lowestDate,
    isLowestBelowInitial: lowestEntry.projectedValue < initialValue,
    avgMonthlyChange,
    monthCount,
  };
};

export const ProjectedSeriesStats = ({
  initialValue,
  initialValueBasis,
  finalProjectedValue,
  currency,
  scenarioResult,
  endDate,
}: ProjectedSeriesStatsProps) => {
  const locale = useLocale();
  const projectedSeriesLabel = useMemo(
    () => getProjectedSeriesLabel(initialValueBasis).toLowerCase(),
    [initialValueBasis],
  );
  const stats = useMemo(
    () =>
      calculateProjectedSeriesStats(
        scenarioResult,
        initialValue,
        finalProjectedValue,
      ),
    [scenarioResult, initialValue, finalProjectedValue],
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Net Change */}
      <Card className="rounded-md py-4 shadow-xs">
        <CardHeader>
          <CardDescription>
            {getProjectedNetChangeLabel(initialValueBasis)}
          </CardDescription>
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
            {initialValue === 0
              ? "N/A%"
              : formatPercentage(stats.netChangePercentage / 100, { locale })}
          </p>
        </CardHeader>
      </Card>

      {/* Lowest projected value */}
      <Card className="rounded-md py-4 shadow-xs">
        <CardHeader>
          <CardDescription className="flex items-center gap-1">
            {getLowestProjectedSeriesLabel(initialValueBasis)}
          </CardDescription>
          <CardTitle
            className={cn(
              "flex items-center gap-2",
              stats.lowestProjectedValue < 0
                ? "text-red-600"
                : stats.isLowestBelowInitial
                  ? "text-yellow-600"
                  : undefined,
            )}
          >
            {formatCurrency(stats.lowestProjectedValue, currency, { locale })}
            {stats.isLowestBelowInitial && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="size-4" />
                </TooltipTrigger>
                <TooltipContent>
                  The lowest projected {projectedSeriesLabel} is below the
                  initial value
                </TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {formatMonthYear(stats.lowestProjectedValueDate, {
              locale,
              month: "short",
              year: "numeric",
            })}
          </p>
        </CardHeader>
      </Card>

      {/* Avg Monthly Change */}
      <Card className="rounded-md py-4 shadow-xs">
        <CardHeader>
          <CardDescription>
            {getAverageProjectedSeriesChangeLabel(initialValueBasis)}
          </CardDescription>
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

      {/* Final projected value */}
      <Card className="rounded-md py-4 shadow-xs">
        <CardHeader>
          <CardDescription>
            {getFinalProjectedSeriesLabel(initialValueBasis)}
          </CardDescription>
          <CardTitle
            className={cn(
              "flex items-center gap-2",
              finalProjectedValue >= initialValue
                ? "text-green-600"
                : "text-yellow-600",
            )}
          >
            {formatCurrency(finalProjectedValue, currency, { locale })}
            {finalProjectedValue < initialValue && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="size-4" />
                </TooltipTrigger>
                <TooltipContent>
                  The final projected {projectedSeriesLabel} is below the
                  initial value
                </TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {formatMonthYear(endDate, {
              locale,
              month: "short",
              year: "numeric",
            })}
          </p>
        </CardHeader>
      </Card>
    </div>
  );
};
