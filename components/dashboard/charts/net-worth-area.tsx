"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  differenceInCalendarDays,
  startOfYear,
  subMonths,
  subYears,
} from "date-fns";
import { Info, TrendingDown, TrendingUp } from "lucide-react";

import {
  fetchNetWorthHistory,
  type NetWorthHistoryData,
} from "@/server/analysis/net-worth/net-worth-history";
import {
  fetchNetWorthChange,
  type NetWorthChangeData,
} from "@/server/analysis/net-worth/net-worth-change";
import { fetchPortfolioPerformanceRange } from "@/server/analysis/performance/fetch-range";
import type {
  PerformanceEligibilityData,
  PerformanceRangeData,
} from "@/server/analysis/performance/types";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { NewAssetButton } from "@/components/dashboard/new-asset";
import { ImportPositionsButton } from "@/components/dashboard/positions/import";
import { useNetWorthMode } from "@/components/dashboard/net-worth-mode/net-worth-mode-provider";
import {
  PrivacyModeButton,
  usePrivacyMode,
} from "@/components/dashboard/providers/privacy-mode-provider";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  formatCompactNumber,
  formatCurrency,
  formatNumber,
  formatPercentage,
} from "@/lib/number-format";
import { formatDate, formatMonthDay } from "@/lib/date/date-format";
import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";

import type { NetWorthMode } from "@/server/analysis/net-worth/types";

type ChartMode = "net_worth" | "performance";
type ChartTimeRange = "1m" | "3m" | "6m" | "ytd" | "1y" | "2y";

interface NetWorthRangePayload {
  history: NetWorthHistoryData[];
  change: NetWorthChangeData;
}

type ChartDatum = {
  date: Date;
  value?: number;
  cumulativeReturnPct?: number;
};

const DEFAULT_TIME_RANGE: ChartTimeRange = "3m";

const TIME_RANGE_LABELS: Record<
  ChartTimeRange,
  { short: string; long: string }
> = {
  "1m": { short: "1M", long: "1 Month" },
  "3m": { short: "3M", long: "3 Months" },
  "6m": { short: "6M", long: "6 Months" },
  ytd: { short: "YTD", long: "YTD" },
  "1y": { short: "1Y", long: "1 Year" },
  "2y": { short: "2Y", long: "2 Years" },
};

function resolveDaysBackForRange(value: ChartTimeRange, todayDateKey: string) {
  const today = new Date(`${todayDateKey}T00:00:00Z`);

  switch (value) {
    case "1m":
      return differenceInCalendarDays(today, subMonths(today, 1)) + 1;
    case "3m":
      return differenceInCalendarDays(today, subMonths(today, 3)) + 1;
    case "6m":
      return differenceInCalendarDays(today, subMonths(today, 6)) + 1;
    case "ytd":
      return differenceInCalendarDays(today, startOfYear(today)) + 1;
    case "1y":
      return differenceInCalendarDays(today, subYears(today, 1)) + 1;
    case "2y":
      return differenceInCalendarDays(today, subYears(today, 2)) + 1;
  }
}

function formatSignedPercentage(value: number, locale: string) {
  const formatted = formatPercentage(value / 100, { locale });
  return value > 0 ? `+${formatted}` : formatted;
}

function PerformanceUnavailableState({ message }: { message: string }) {
  return (
    <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="bg-accent rounded-lg p-2">
        <Info className="text-muted-foreground size-4" />
      </div>
      <p className="mt-3 font-medium">Investments Performance</p>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{message}</p>
    </CardContent>
  );
}

export function NetWorthAreaChart({
  currency,
  netWorth,
  history: initialHistory,
  change: initialChange,
  todayDateKey,
  netWorthMode,
  estimatedCapitalGainsTax,
  performanceEligibility,
}: {
  currency: string;
  netWorth: number;
  history: NetWorthHistoryData[];
  change: NetWorthChangeData;
  todayDateKey: string;
  netWorthMode: NetWorthMode;
  estimatedCapitalGainsTax: number | null;
  performanceEligibility: PerformanceEligibilityData;
}) {
  const [selectedChartMode, setSelectedChartMode] =
    useState<ChartMode>("net_worth");
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<ChartTimeRange>(DEFAULT_TIME_RANGE);
  const [netWorthRanges, setNetWorthRanges] = useState<
    Partial<Record<ChartTimeRange, NetWorthRangePayload>>
  >({
    [DEFAULT_TIME_RANGE]: {
      history: initialHistory,
      change: initialChange,
    },
  });
  const [performanceRanges, setPerformanceRanges] = useState<
    Partial<Record<ChartTimeRange, PerformanceRangeData>>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const netWorthRangesRef = useRef(netWorthRanges);
  const performanceRangesRef = useRef(performanceRanges);

  const { isPrivacyMode } = usePrivacyMode();
  const { dashboardDataVersion } = useDashboardData();
  const { isRefreshing: isModeRefreshing } = useNetWorthMode();
  const locale = useLocale();

  useEffect(() => {
    setNetWorthRanges({
      [DEFAULT_TIME_RANGE]: {
        history: initialHistory,
        change: initialChange,
      },
    });
  }, [initialHistory, initialChange]);

  useEffect(() => {
    netWorthRangesRef.current = netWorthRanges;
  }, [netWorthRanges]);

  useEffect(() => {
    performanceRangesRef.current = performanceRanges;
  }, [performanceRanges]);

  useEffect(() => {
    if (selectedChartMode === "net_worth") {
      setSelectedTimeRange(DEFAULT_TIME_RANGE);
    }
  }, [netWorthMode, selectedChartMode]);

  useEffect(() => {
    setPerformanceRanges({});
  }, [currency]);

  useEffect(() => {
    if (
      !performanceEligibility.isEligible &&
      selectedChartMode === "performance"
    ) {
      setSelectedChartMode("net_worth");
    }
  }, [performanceEligibility.isEligible, selectedChartMode]);

  const netWorthRange =
    netWorthRanges[selectedTimeRange] ?? netWorthRanges[DEFAULT_TIME_RANGE];
  const performanceRange = performanceRanges[selectedTimeRange];
  const isChartLoading =
    isLoading || (selectedChartMode === "net_worth" && isModeRefreshing);

  const shouldShowTaxLine =
    selectedChartMode === "net_worth" && netWorthMode === "after_capital_gains";
  const taxValue = estimatedCapitalGainsTax ?? 0;

  const netWorthHistory = netWorthRange?.history ?? initialHistory;
  const netWorthChange = netWorthRange?.change ?? initialChange;
  const performanceHistory =
    performanceRange?.isAvailable === true ? performanceRange.history : [];
  const performanceSummary =
    performanceRange?.isAvailable === true ? performanceRange.summary : null;
  const shouldShowEstimatedPerformanceBadge =
    selectedChartMode === "performance" &&
    performanceRange?.isAvailable === true &&
    performanceRange.includesEstimatedFlows;

  const chartColor =
    selectedChartMode === "performance"
      ? (performanceSummary?.cumulativeReturnPct ?? 0) >= 0
        ? "oklch(0.72 0.19 150)"
        : "oklch(0.64 0.21 25)"
      : netWorthChange.percentageChange >= 0
        ? "oklch(0.72 0.19 150)"
        : "oklch(0.64 0.21 25)";

  const performanceMessage = !performanceEligibility.isEligible
    ? performanceEligibility.message
    : performanceRange?.isAvailable === false
      ? performanceRange.message
      : null;

  const loadNetWorthRange = useCallback(
    async (timeRange: ChartTimeRange, options?: { force?: boolean }) => {
      if (!options?.force && netWorthRangesRef.current[timeRange]) {
        return;
      }

      const daysBack = resolveDaysBackForRange(timeRange, todayDateKey);
      const [history, change] = await Promise.all([
        fetchNetWorthHistory({
          targetCurrency: currency,
          daysBack,
          mode: netWorthMode,
        }),
        fetchNetWorthChange({
          targetCurrency: currency,
          daysBack,
          mode: netWorthMode,
        }),
      ]);

      setNetWorthRanges((currentRanges) => ({
        ...currentRanges,
        [timeRange]: {
          history,
          change,
        },
      }));
    },
    [currency, netWorthMode, todayDateKey],
  );

  const loadPerformanceRange = useCallback(
    async (timeRange: ChartTimeRange, options?: { force?: boolean }) => {
      if (
        !performanceEligibility.isEligible ||
        (!options?.force && performanceRangesRef.current[timeRange])
      ) {
        return;
      }

      const result = await fetchPortfolioPerformanceRange({
        targetCurrency: currency,
        daysBack: resolveDaysBackForRange(timeRange, todayDateKey),
        methodology: "time_weighted_return",
        scope: "symbol_assets",
      });

      setPerformanceRanges((currentRanges) => ({
        ...currentRanges,
        [timeRange]: result,
      }));
    },
    [currency, performanceEligibility.isEligible, todayDateKey],
  );

  const ensureRangeLoaded = useCallback(
    async (
      chartMode: ChartMode,
      timeRange: ChartTimeRange,
      options?: { force?: boolean },
    ) => {
      if (chartMode === "performance") {
        await loadPerformanceRange(timeRange, options);
        return;
      }

      await loadNetWorthRange(timeRange, options);
    },
    [loadNetWorthRange, loadPerformanceRange],
  );

  useEffect(() => {
    if (dashboardDataVersion === 0) {
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    void ensureRangeLoaded(selectedChartMode, selectedTimeRange, {
      force: true,
    }).finally(() => {
      if (!isCancelled) {
        setIsLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    dashboardDataVersion,
    ensureRangeLoaded,
    selectedChartMode,
    selectedTimeRange,
  ]);

  const handleRangeChange = async (value: string) => {
    const nextRange = value as ChartTimeRange;
    setSelectedTimeRange(nextRange);
    setIsLoading(true);

    try {
      await ensureRangeLoaded(selectedChartMode, nextRange);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChartModeChange = async (value: string) => {
    const nextMode = value as ChartMode;
    setSelectedChartMode(nextMode);

    if (nextMode === "performance" && !performanceEligibility.isEligible) {
      return;
    }

    setIsLoading(true);
    try {
      await ensureRangeLoaded(nextMode, selectedTimeRange);
    } finally {
      setIsLoading(false);
    }
  };

  const formatXAxisDate = (date: Date) =>
    formatMonthDay(date, { locale, month: "short", day: "numeric" });

  const formatCurrencyYAxisValue = (value: number) =>
    formatCompactNumber(value, { locale });

  const formatPerformanceYAxisValue = (value: number) =>
    formatPercentage(value / 100, { locale, decimals: 0 });

  const chartData: ChartDatum[] =
    selectedChartMode === "performance" ? performanceHistory : netWorthHistory;
  const chartMetricLabel =
    selectedChartMode === "performance"
      ? `Rate of Return (${TIME_RANGE_LABELS[selectedTimeRange].short})`
      : `Change (${TIME_RANGE_LABELS[selectedTimeRange].short})`;
  const chartMetricIsPositive =
    selectedChartMode === "performance"
      ? (performanceSummary?.cumulativeReturnPct ?? 0) >= 0
      : netWorthChange.absoluteChange >= 0;
  const chartMetricValue =
    selectedChartMode === "performance"
      ? isPrivacyMode
        ? "* * * * * *"
        : performanceSummary
          ? formatSignedPercentage(
              performanceSummary.cumulativeReturnPct,
              locale,
            )
          : "N/A"
      : isPrivacyMode
        ? "* * * * * *"
        : `${netWorthChange.absoluteChange >= 0 ? "+" : ""}${formatNumber(
            netWorthChange.absoluteChange,
            {
              locale,
              maximumFractionDigits: 2,
            },
          )} (${netWorthChange.percentageChange >= 0 ? "+" : ""}${
            netWorthChange.previousValue === 0
              ? "N/A"
              : formatPercentage(netWorthChange.percentageChange / 100, {
                  locale,
                })
          })`;

  return (
    <Card className="flex h-80 flex-col rounded-lg shadow-xs">
      {netWorth === 0 ? (
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <TrendingUp className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Net Worth History</p>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Add your assets to start tracking your net worth
          </p>
          <div className="flex items-center justify-center gap-2">
            <NewAssetButton />
            <ImportPositionsButton variant="outline" />
          </div>
        </CardContent>
      ) : (
        <>
          <CardHeader className="flex flex-none flex-row justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-col gap-0 md:flex-row md:items-start md:gap-4">
                {/* Net worth value */}
                <div className="min-w-0">
                  <CardDescription>
                    {netWorthMode === "after_capital_gains"
                      ? "Net Worth (After Tax)"
                      : "Net Worth"}
                  </CardDescription>
                  <div className="flex items-center gap-1">
                    <h2 className="text-xl font-semibold">
                      {isPrivacyMode
                        ? "* * * * * * * *"
                        : formatCurrency(netWorth, currency, { locale })}
                    </h2>
                    <PrivacyModeButton className="text-muted-foreground size-6" />
                  </div>
                </div>

                {/* Chart metric */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-muted-foreground hidden text-sm md:block">
                      {chartMetricLabel}
                    </p>
                    {shouldShowEstimatedPerformanceBadge ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="text-muted-foreground inline-flex items-center gap-1 text-sm"
                            aria-label="Estimated performance details"
                          >
                            <span>Estimated</span>
                            <Info className="size-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          Market-backed Update records can make performance
                          approximate.
                          <br />
                          Prefer Buy and Sell records for the most accurate
                          results.
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      chartMetricIsPositive ? "text-green-600" : "text-red-600",
                    )}
                  >
                    <span className="text-sm font-medium md:text-base">
                      {chartMetricValue}
                    </span>
                    {chartMetricIsPositive ? (
                      <TrendingUp className="size-4" />
                    ) : (
                      <TrendingDown className="size-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Estimated capital gains tax */}
              {shouldShowTaxLine ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Est. Capital Gains Tax:{" "}
                  {isPrivacyMode
                    ? "* * * * * *"
                    : `${formatCurrency(taxValue, currency, { locale })}`}
                </p>
              ) : null}
            </div>

            {/* Chart controls */}
            <div className="flex items-center gap-2">
              {/* Chart mode selector - Desktop only, mobile TO-DO */}
              <Tabs
                value={selectedChartMode}
                onValueChange={handleChartModeChange}
                className="hidden sm:block"
              >
                <TabsList>
                  <TabsTrigger value="net_worth">Value</TabsTrigger>
                  <TabsTrigger
                    value="performance"
                    disabled={!performanceEligibility.isEligible}
                  >
                    Performance
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Info />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Symbol-backed investments only.
                        <br />
                        Pre-tax. Excludes cash and manual assets.
                      </TooltipContent>
                    </Tooltip>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Time range selector */}
              <Select
                name="net-worth-time-range"
                value={selectedTimeRange}
                onValueChange={handleRangeChange}
                disabled={isChartLoading}
              >
                <SelectTrigger>
                  <span>
                    {TIME_RANGE_LABELS[selectedTimeRange]?.short ??
                      selectedTimeRange}
                  </span>
                </SelectTrigger>
                <SelectContent align="end" position="popper">
                  <SelectItem value="1m">
                    {TIME_RANGE_LABELS["1m"].long}
                  </SelectItem>
                  <SelectItem value="3m">
                    {TIME_RANGE_LABELS["3m"].long}
                  </SelectItem>
                  <SelectItem value="6m">
                    {TIME_RANGE_LABELS["6m"].long}
                  </SelectItem>
                  <SelectItem value="ytd">
                    {TIME_RANGE_LABELS.ytd.long}
                  </SelectItem>
                  <SelectItem value="1y">
                    {TIME_RANGE_LABELS["1y"].long}
                  </SelectItem>
                  <SelectItem value="2y">
                    {TIME_RANGE_LABELS["2y"].long}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          {selectedChartMode === "performance" && performanceMessage ? (
            <PerformanceUnavailableState message={performanceMessage} />
          ) : selectedChartMode === "performance" && !performanceRange ? (
            <CardContent className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              Loading performance...
            </CardContent>
          ) : (
            <CardContent
              className={cn(
                "flex-1 transition-opacity",
                isChartLoading && "opacity-50",
              )}
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 256, height: 128 }}
              >
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="areaGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={chartColor}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor={chartColor}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <YAxis
                    dataKey={
                      selectedChartMode === "performance"
                        ? "cumulativeReturnPct"
                        : "value"
                    }
                    tickFormatter={
                      selectedChartMode === "performance"
                        ? formatPerformanceYAxisValue
                        : formatCurrencyYAxisValue
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "var(--muted-foreground)",
                      opacity: isPrivacyMode ? 0 : 1,
                    }}
                    domain={["auto", "auto"]}
                    width={40}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatXAxisDate}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    dy={5}
                    minTickGap={20}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;

                      const data = payload[0];
                      return (
                        <div className="bg-background border-border flex flex-col gap-1 rounded-md border px-2.5 py-1.5">
                          <span className="text-muted-foreground text-xs">
                            {formatDate(data.payload.date, { locale })}
                          </span>
                          <span className="text-sm">
                            {selectedChartMode === "performance"
                              ? formatSignedPercentage(
                                  Number(data.value),
                                  locale,
                                )
                              : formatCurrency(Number(data.value), currency, {
                                  locale,
                                })}
                          </span>
                        </div>
                      );
                    }}
                    cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  />
                  <Area
                    dataKey={
                      selectedChartMode === "performance"
                        ? "cumulativeReturnPct"
                        : "value"
                    }
                    stroke={chartColor}
                    strokeWidth={1.5}
                    fill="url(#areaGradient)"
                    fillOpacity={1}
                    dot={false}
                    activeDot={{
                      r: 4.5,
                      strokeWidth: 2.5,
                      filter: "drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.3))",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          )}
        </>
      )}
    </Card>
  );
}
