"use client";

import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { addYears, formatDate } from "date-fns";
import { Plus, GitBranch } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DemoBalanceChart } from "./demo-balance-chart";
import { BalanceStats } from "../stats/balance-stats";

import { runScenario, Scenario, ScenarioEvent } from "@/lib/scenario-planning";
import { fromJSDate } from "@/lib/local-date";
import {
  formatCompactNumber,
  formatCurrency,
  formatSignedCurrency,
} from "@/lib/number-format";
import { cn } from "@/lib/utils";

const CustomEventMarker = (props: {
  cx?: number;
  cy?: number;
  icon: string;
  netCashflow: number;
  count?: number;
  isHovered?: boolean;
}) => {
  const { cx, cy, icon, netCashflow, count, isHovered } = props;

  if (!cx || !cy) return null;

  // Negative cashflow (balance drop) = bigger, more prominent
  // Positive cashflow = smaller, less prominent
  const isNegative = netCashflow < 0;
  const baseRadius = isNegative ? 16 : 10;
  const baseFontSize = isNegative ? 18 : 14;
  const baseStrokeWidth = isNegative ? 3 : 2;

  // Scale up when hovered
  const radius = isHovered ? baseRadius * 1.2 : baseRadius;
  const fontSize = isHovered ? baseFontSize * 1.2 : baseFontSize;
  const strokeWidth = isHovered ? baseStrokeWidth * 1.2 : baseStrokeWidth;

  // Define area chart color based on net cashflow
  const backgroundColor =
    netCashflow >= 0
      ? "oklch(0.72 0.19 150)" // green
      : "oklch(0.64 0.21 25)"; // red

  const showBadge = count && count > 1;

  return (
    <g>
      {/* Background circle */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={backgroundColor}
        stroke="var(--background)"
        strokeWidth={strokeWidth}
        style={{
          transition: "all 0.2s ease",
          filter: isHovered
            ? "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.3))"
            : "none",
        }}
      />
      {/* Icon text */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        style={{
          userSelect: "none",
          transition: "all 0.2s ease",
        }}
      >
        {icon}
      </text>
      {/* Counter badge */}
      {showBadge && (
        <g>
          <circle
            cx={cx + baseRadius - 2}
            cy={cy - baseRadius + 2}
            r={8}
            fill="var(--background)"
            stroke={backgroundColor}
            strokeWidth={1.5}
          />
          <text
            x={cx + baseRadius - 2}
            y={cy - baseRadius + 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight="bold"
            fill={backgroundColor}
            style={{ userSelect: "none" }}
          >
            {count}
          </text>
        </g>
      )}
    </g>
  );
};

export function BalanceChart({
  scenario,
  currency,
  initialBalance,
  onAddEvent,
}: {
  scenario: Scenario;
  currency: string;
  initialBalance: number;
  onAddEvent?: () => void;
}) {
  const [timeHorizon, setTimeHorizon] = useState<"2" | "5" | "10" | "30">("5");
  const [scale, setScale] = useState<"monthly" | "quarterly" | "yearly">(
    "monthly",
  );
  const [hoveredTimestamp, setHoveredTimestamp] = useState<number | null>(null);

  const deferredHoveredTimestamp = useDeferredValue(hoveredTimestamp);

  const endDate = useMemo(() => {
    return addYears(new Date(), parseInt(timeHorizon, 10));
  }, [timeHorizon]);

  const { scenarioResult } = useMemo(() => {
    const scenarioResult = runScenario({
      scenario,
      initialBalance,
      startDate: fromJSDate(new Date()),
      endDate: fromJSDate(endDate),
    });

    return {
      scenarioResult,
    };
  }, [scenario, initialBalance, endDate]);

  const getPeriodKey = useCallback(
    (date: Date): string => {
      const year = date.getFullYear();
      const month = date.getMonth();

      switch (scale) {
        case "monthly":
          return `${year}-${String(month + 1).padStart(2, "0")}`;
        case "quarterly":
          const quarter = Math.floor(month / 3) + 1;
          return `${year}-Q${quarter}`;
        case "yearly":
          return `${year}`;
        default:
          return `${year}-${String(month + 1).padStart(2, "0")}`;
      }
    },
    [scale],
  );

  const chartData = useMemo(() => {
    const sortedMonths = Object.keys(scenarioResult.balance).sort();

    if (scale === "monthly") {
      // Monthly view - no aggregation needed
      const data: Array<{
        monthKey: string;
        timestamp: number;
        date: Date;
        balance: number;
        cashflow: number;
        events: ScenarioEvent[];
      }> = [];

      sortedMonths.forEach((monthKey) => {
        const [yearStr, monthStr] = monthKey.split("-");
        const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);

        data.push({
          monthKey,
          timestamp: date.getTime(),
          date,
          balance: scenarioResult.balance[monthKey],
          cashflow: scenarioResult.cashflow[monthKey]?.amount || 0,
          events: scenarioResult.cashflow[monthKey]?.events || [],
        });
      });

      return data;
    } else {
      // Quarterly or Yearly - aggregate data
      const periodMap = new Map<
        string,
        {
          monthKey: string;
          timestamp: number;
          date: Date;
          balance: number;
          cashflow: number;
          events: ScenarioEvent[];
          monthCount: number;
        }
      >();

      sortedMonths.forEach((monthKey) => {
        const [yearStr, monthStr] = monthKey.split("-");
        const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
        const periodKey = getPeriodKey(date);

        if (!periodMap.has(periodKey)) {
          periodMap.set(periodKey, {
            monthKey: periodKey,
            timestamp: date.getTime(),
            date,
            balance: scenarioResult.balance[monthKey],
            cashflow: 0,
            events: [],
            monthCount: 0,
          });
        }

        const period = periodMap.get(periodKey)!;
        // Use the latest balance for the period
        period.balance = scenarioResult.balance[monthKey];
        // Sum cashflow
        period.cashflow += scenarioResult.cashflow[monthKey]?.amount || 0;
        // Collect all events
        const monthEvents = scenarioResult.cashflow[monthKey]?.events || [];
        period.events.push(...monthEvents);
        period.monthCount++;
      });

      return Array.from(periodMap.values()).sort(
        (a, b) => a.timestamp - b.timestamp,
      );
    }
  }, [scenarioResult, scale, getPeriodKey]);

  const eventMarkers = useMemo(() => {
    const markers: Array<{
      monthKey: string;
      timestamp: number;
      date: Date;
      balance: number;
      events: Array<{
        name: string;
        type: "income" | "expense";
        amount: number;
      }>;
      biggestEvent: {
        name: string;
        type: "income" | "expense";
        amount: number;
        icon: string;
      };
      netCashflow: number;
      iconCount?: number;
    }> = [];

    chartData.forEach((point) => {
      if (point.events.length > 0) {
        const netCashflow = point.events.reduce((sum, event) => {
          const amount = event.type === "income" ? event.amount : -event.amount;
          return sum + amount;
        }, 0);

        const group = new Map<
          string,
          { count: number; event: ScenarioEvent }
        >();

        point.events.forEach((event) => {
          const name = event.name;

          if (!group.has(name)) {
            group.set(name, { count: 0, event });
          }
          group.get(name)!.count++;
        });

        const biggestEvent = point.events.reduce((acc, curr) => {
          if (acc.amount < curr.amount) {
            return curr;
          } else {
            return acc;
          }
        }, point.events.at(0)!);

        const getFirstCharacter = (str: string): string => {
          // Use Array.from to properly split multi-byte characters, like emojis
          const chars = Array.from(str);
          return chars[0] || "";
        };

        markers.push({
          monthKey: point.monthKey,
          timestamp: point.timestamp,
          date: point.date,
          balance: point.balance,
          events: point.events.map((e) => ({
            name: e.name,
            type: e.type,
            amount: e.amount,
          })),
          biggestEvent: {
            name: biggestEvent.name,
            type: biggestEvent.type,
            amount: biggestEvent.amount,
            icon: getFirstCharacter(biggestEvent.name),
          },
          netCashflow,
          iconCount: point.events.length,
        });
      }
    });

    return markers;
  }, [chartData]);

  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return ["auto", "auto"] as const;

    // Helper function to round to nice numbers
    const roundToNice = (value: number, roundUp: boolean): number => {
      if (value === 0) return 0;

      const sign = value < 0 ? -1 : 1;
      const absValue = Math.abs(value);

      // Determine the magnitude (power of 10)
      const magnitude = Math.pow(10, Math.floor(Math.log10(absValue)));

      // Determine nice interval based on magnitude
      let interval: number;
      if (magnitude >= 100000) {
        // For 100K+: use 20K intervals
        interval = 20000;
      } else if (magnitude >= 10000) {
        // For 10K-100K: use 10K intervals
        interval = 10000;
      } else if (magnitude >= 1000) {
        // For 1K-10K: use 5K intervals
        interval = 5000;
      } else if (magnitude >= 100) {
        // For 100-1K: use 500 intervals
        interval = 500;
      } else if (magnitude >= 10) {
        // For 10-100: use 50 intervals
        interval = 50;
      } else {
        // For <10: use 5 intervals
        interval = 5;
      }

      // Round to the nearest interval
      const rounded = roundUp
        ? Math.ceil(absValue / interval) * interval
        : Math.floor(absValue / interval) * interval;

      return sign * rounded;
    };

    // Find min and max balance values
    const balances = chartData.map((d) => d.balance);
    const minBalance = Math.min(...balances);
    const maxBalance = Math.max(...balances);

    // Calculate range
    const range = maxBalance - minBalance;

    // Add 20% padding on each side
    const padding = range * 0.2;

    // If range is 0 (all values are the same), add fixed padding
    if (range === 0) {
      const fixedPadding = Math.abs(minBalance) * 0.2 || 1000;
      const domainMin = roundToNice(minBalance - fixedPadding, false);
      const domainMax = roundToNice(maxBalance + fixedPadding, true);
      return [domainMin, domainMax] as const;
    }

    // Apply padding and round to nice numbers
    const domainMin = roundToNice(minBalance - padding, false);
    const domainMax = roundToNice(maxBalance + padding, true);

    return [domainMin, domainMax] as const;
  }, [chartData]);

  const isPositiveTrend = useMemo(() => {
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

    if (scale === "yearly") {
      return date.getFullYear().toString();
    } else if (scale === "quarterly") {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `Q${quarter} ${date.getFullYear().toString().slice(2)}`;
    } else {
      return formatDate(date, "MMM yyyy");
    }
  };

  const formatYAxisValue = (value: number) => {
    return formatCompactNumber(value);
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-lg shadow-xs">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex w-full flex-col gap-1">
            <CardTitle>Balance Over Time</CardTitle>
            <CardDescription>
              Financial projection with conditional events
            </CardDescription>
          </div>
          <div className="flex w-full items-center gap-2 md:justify-end">
            <Select
              value={scale}
              onValueChange={(value) =>
                setScale(value as "monthly" | "quarterly" | "yearly")
              }
            >
              <SelectTrigger className="w-1/2 md:w-32">
                <SelectValue placeholder="Scale" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={timeHorizon}
              onValueChange={(value) =>
                setTimeHorizon(value as "2" | "5" | "10" | "30")
              }
            >
              <SelectTrigger className="w-1/2 md:w-32">
                <SelectValue placeholder="Time horizon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 years</SelectItem>
                <SelectItem value="5">5 years</SelectItem>
                <SelectItem value="10">10 years</SelectItem>
                <SelectItem value="30">30 years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="h-80">
          {scenario.events.length === 0 ? (
            <div className="relative h-full">
              {/* Demo chart in background */}
              <div className="absolute inset-0 opacity-25">
                <DemoBalanceChart initialBalance={initialBalance} />
              </div>

              {/* Empty state overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="bg-accent rounded-lg p-2">
                  <GitBranch className="text-muted-foreground size-4" />
                </div>
                <p className="mt-3 font-medium">Balance Over Time</p>
                <p className="text-muted-foreground mt-1 mb-3 text-sm">
                  Add events to see how your balance changes over time
                </p>
                {onAddEvent && (
                  <Button onClick={onAddEvent}>
                    <Plus className="size-4" />
                    New Event
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                onMouseMove={(state) => {
                  if (state.activeIndex == null) {
                    setHoveredTimestamp(null);
                  } else {
                    const data =
                      chartData[
                        typeof state.activeIndex === "string"
                          ? parseInt(state.activeIndex)
                          : state.activeIndex
                      ];

                    if (data == null) {
                      return;
                    }

                    setHoveredTimestamp(data.timestamp);
                  }
                }}
              >
                <defs>
                  <linearGradient
                    id="scenarioGradient"
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
                  fill="url(#scenarioGradient)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={false}
                />

                {/* Event markers - custom icons based on biggest event */}
                {eventMarkers.map((marker, markerIndex) => {
                  const isHovered =
                    deferredHoveredTimestamp === marker.timestamp;
                  return (
                    <ReferenceDot
                      key={markerIndex}
                      x={marker.timestamp}
                      y={marker.balance}
                      shape={(props: { cx?: number; cy?: number }) => (
                        <CustomEventMarker
                          cx={props.cx}
                          cy={props.cy}
                          icon={marker.biggestEvent.icon}
                          netCashflow={marker.netCashflow}
                          count={marker.iconCount}
                          isHovered={isHovered}
                        />
                      )}
                    />
                  );
                })}

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active) {
                      return null;
                    }

                    const data = payload[0].payload;
                    const monthData = chartData.find(
                      (d) => d.timestamp === data.timestamp,
                    );

                    if (!monthData) return null;

                    const periodLabel =
                      scale === "yearly"
                        ? monthData.date.getFullYear().toString()
                        : scale === "quarterly"
                          ? `Q${Math.floor(monthData.date.getMonth() / 3) + 1} ${monthData.date.getFullYear()}`
                          : formatDate(monthData.date, "MMMM yyyy");

                    const cashflowLabel =
                      scale === "yearly"
                        ? "Yearly cash flow:"
                        : scale === "quarterly"
                          ? "Quarterly cash flow:"
                          : "Monthly cash flow:";

                    // Group events by name and sum amounts
                    const eventsGroupedByNameMap = new Map<
                      string,
                      {
                        counter: number;
                        amount: number;
                        type: "income" | "expense";
                      }
                    >();

                    for (const event of monthData.events) {
                      if (eventsGroupedByNameMap.has(event.name)) {
                        const prev = eventsGroupedByNameMap.get(event.name)!;
                        eventsGroupedByNameMap.set(event.name, {
                          counter: prev.counter + 1,
                          amount: prev.amount + event.amount,
                          type: event.type,
                        });
                      } else {
                        eventsGroupedByNameMap.set(event.name, {
                          counter: 1,
                          amount: event.amount,
                          type: event.type,
                        });
                      }
                    }

                    // Convert grouped map to array with proper naming
                    const eventsGrouped = Array.from(
                      eventsGroupedByNameMap.entries(),
                    ).map(([name, group]) => ({
                      name:
                        group.counter > 1 ? `${name} (${group.counter})` : name,
                      amount: group.amount,
                      type: group.type,
                    }));

                    return (
                      <div className="bg-background border-border flex flex-col gap-1 rounded-md border px-2.5 py-1.5">
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-xs">
                            {periodLabel}
                          </p>
                          <p className="text-sm font-medium">
                            Balance:{" "}
                            {formatCurrency(monthData.balance, currency)}
                          </p>
                        </div>

                        {/* Cashflow */}
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-muted-foreground text-xs">
                            {cashflowLabel}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-medium",
                              monthData.cashflow >= 0
                                ? "text-green-600"
                                : "text-red-600",
                            )}
                          >
                            {formatSignedCurrency(monthData.cashflow, currency)}
                          </span>
                        </div>

                        <Separator />

                        {/* Events */}
                        {eventsGrouped.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs font-medium">
                              Events ({monthData.events.length}):
                            </p>
                            <div className="space-y-1">
                              {(() => {
                                // Sort events by amount: negative (expenses) first, then positive (income)
                                const sortedEvents = [...eventsGrouped].sort(
                                  (a, b) => {
                                    const aValue =
                                      a.type === "income"
                                        ? a.amount
                                        : -a.amount;
                                    const bValue =
                                      b.type === "income"
                                        ? b.amount
                                        : -b.amount;

                                    // Negative values first (expenses), then positive (income)
                                    // Within each group, sort by absolute value descending
                                    if (aValue < 0 && bValue >= 0) return -1;
                                    if (aValue >= 0 && bValue < 0) return 1;

                                    // Both negative or both positive - sort by absolute value descending
                                    return Math.abs(bValue) - Math.abs(aValue);
                                  },
                                );

                                // Build event list with trigger information
                                const eventsToRender: Array<{
                                  event?: {
                                    name: string;
                                    amount: number;
                                    type: "income" | "expense";
                                  };
                                  isTriggered: boolean;
                                  triggerEvent?: string;
                                  isReference?: boolean;
                                }> = [];

                                // Create a map of triggered events
                                const triggeredEventsMap = new Map<
                                  string,
                                  string
                                >();

                                // Add all sorted events with their trigger info
                                sortedEvents.forEach((event) => {
                                  const triggerEvent = triggeredEventsMap.get(
                                    event.name,
                                  );
                                  eventsToRender.push({
                                    event,
                                    isTriggered: !!triggerEvent,
                                    triggerEvent,
                                  });
                                });

                                return eventsToRender.map((item, idx) => {
                                  if (item.isReference) {
                                    // This is a parent reference (not firing this month)
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between gap-2 text-xs"
                                      >
                                        <span className="text-muted-foreground/60 truncate italic">
                                          {item.triggerEvent}
                                        </span>
                                        <span className="text-muted-foreground/60 text-xs whitespace-nowrap italic">
                                          (trigger)
                                        </span>
                                      </div>
                                    );
                                  }

                                  const value =
                                    item.event!.type === "income"
                                      ? item.event!.amount
                                      : -item.event!.amount;
                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between gap-2 text-xs"
                                    >
                                      <span
                                        className={cn(
                                          "text-muted-foreground flex items-center gap-1 truncate",
                                          item.isTriggered ? "pl-3" : "",
                                        )}
                                      >
                                        {item.isTriggered && "├─ "}
                                        {item.event!.name}
                                      </span>
                                      <span
                                        className={`font-medium whitespace-nowrap ${
                                          value >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }`}
                                      >
                                        {formatSignedCurrency(value, currency)}
                                      </span>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }}
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      {scenario.events.length > 0 && (
        <BalanceStats
          initialBalance={initialBalance}
          finalBalance={chartData.at(-1)?.balance || 0}
          currency={currency}
          scenarioResult={scenarioResult}
          startDate={new Date()}
          endDate={endDate}
        />
      )}
    </div>
  );
}
