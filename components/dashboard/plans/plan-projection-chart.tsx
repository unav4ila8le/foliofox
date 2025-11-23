"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from "recharts";
import { format, isSameMonth } from "date-fns";

import type { ProjectionResult, OneTimeEvent, RecurringEvent } from "@/lib/planning-engine";
import { formatCurrency, formatCompactNumber } from "@/lib/number-format";
import {
  aggregateProjection,
  groupEventMarkers,
  formatPeriodLabel,
  getPeriodDescription,
  type TimeScale,
  type AggregatedProjectionPoint,
  type EventMarkerGroup,
} from "@/lib/projection-aggregation";

interface PlanProjectionChartProps {
  historicalData: Array<{ date: Date; netWorth: number }>;
  projection: ProjectionResult;
  currency: string;
  privacyMode?: boolean;
  oneTimeEvents?: OneTimeEvent[];
  recurringEvents?: RecurringEvent[];
  onToggleEvent?: (eventId: string, type: 'one-time' | 'recurring') => void;
  timeScale?: TimeScale;
}

export function PlanProjectionChart({
  historicalData,
  projection,
  currency,
  privacyMode = false,
  oneTimeEvents = [],
  recurringEvents = [],
  onToggleEvent,
  timeScale = 'monthly',
}: PlanProjectionChartProps) {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  // Aggregate projection data based on time scale
  const aggregatedData = useMemo(() => {
    return aggregateProjection(projection.points, timeScale);
  }, [projection.points, timeScale]);

  // Combine historical and projected data
  const chartData = useMemo(() => {
    const data: Array<{
      timestamp: number;
      date: Date;
      value: number;
      isProjection: boolean;
    }> = [];

    // Add historical data (keep as monthly for now)
    historicalData.forEach((point) => {
      data.push({
        timestamp: point.date.getTime(),
        date: point.date,
        value: point.netWorth,
        isProjection: false,
      });
    });

    // Add aggregated projected data
    aggregatedData.forEach((point) => {
      data.push({
        timestamp: point.date.getTime(),
        date: point.date,
        value: point.netWorth,
        isProjection: true,
      });
    });

    return data;
  }, [historicalData, aggregatedData]);

  // Find event markers (events that occur within the projection timeframe) - now grouped by period
  const eventMarkerGroups = useMemo(() => {
    const allEventMarkers: Array<{
      id: string;
      date: Date;
      description: string;
      amount: number;
      emoji?: string;
      type: 'one-time' | 'recurring';
      eventType: 'one-time' | 'recurring';
      enabled: boolean;
    }> = [];

    // Add one-time events
    oneTimeEvents.forEach((event) => {
      allEventMarkers.push({
        id: event.id,
        date: event.date,
        description: event.description,
        amount: event.amount,
        emoji: event.emoji,
        type: 'one-time',
        eventType: 'one-time',
        enabled: event.enabled !== false,
      });
    });

    // Add recurring event markers - find all occurrences from projection points
    recurringEvents.forEach((event) => {
      const enabled = event.enabled !== false;

      if (enabled) {
        // Find all occurrences from projection points
        projection.points.forEach((point) => {
          const hasEvent = point.events.find(e =>
            e.type === 'recurring' && e.description === event.description
          );

          if (hasEvent) {
            allEventMarkers.push({
              id: event.id,
              date: point.date,
              description: event.description,
              amount: hasEvent.amount || event.amount,
              emoji: event.emoji,
              type: 'recurring',
              eventType: 'recurring',
              enabled: true,
            });
          }
        });
      } else {
        // For disabled events, just show at start date
        allEventMarkers.push({
          id: event.id,
          date: event.startDate,
          description: event.description,
          amount: event.amount,
          emoji: event.emoji,
          type: 'recurring',
          eventType: 'recurring',
          enabled: false,
        });
      }
    });

    // Group events by time period
    return groupEventMarkers(allEventMarkers, aggregatedData, timeScale);
  }, [oneTimeEvents, recurringEvents, projection.points, aggregatedData, timeScale]);

  // Calculate annual summaries for year tooltips
  const yearSummaries = useMemo(() => {
    const summaries = new Map<number, {
      year: number;
      events: Array<{ description: string; amount: number; emoji?: string }>;
      earnings: number;
      expenses: number;
      savings: number;
      startNetWorth: number;
      endNetWorth: number;
      delta: number;
    }>();

    projection.points.forEach((point, index) => {
      const year = point.date.getFullYear();

      if (!summaries.has(year)) {
        summaries.set(year, {
          year,
          events: [],
          earnings: 0,
          expenses: 0,
          savings: 0,
          startNetWorth: index === 0 ? point.netWorth : projection.points[index].netWorth,
          endNetWorth: point.netWorth,
          delta: 0,
        });
      }

      const summary = summaries.get(year)!;

      // Track end net worth (will be overwritten with last month of year)
      summary.endNetWorth = point.netWorth;

      // Aggregate cash flows
      if (point.monthlyChange) {
        const cashFlow = point.monthlyChange.cashFlow;
        if (cashFlow > 0) {
          summary.earnings += cashFlow;
        } else {
          summary.expenses += Math.abs(cashFlow);
        }
        summary.savings += cashFlow;
      }

      // Collect events for this month
      point.events.forEach(event => {
        const matchingOneTime = oneTimeEvents.find(e =>
          e.description === event.description && event.type === 'one-time'
        );
        const matchingRecurring = recurringEvents.find(e =>
          e.description === event.description && event.type === 'recurring'
        );

        summary.events.push({
          description: event.description,
          amount: event.amount || 0,
          emoji: matchingOneTime?.emoji || matchingRecurring?.emoji,
        });
      });
    });

    // Calculate deltas (year-over-year change)
    const years = Array.from(summaries.keys()).sort();
    years.forEach((year, index) => {
      const summary = summaries.get(year)!;
      if (index > 0) {
        const prevYear = years[index - 1];
        const prevSummary = summaries.get(prevYear)!;
        summary.delta = summary.endNetWorth - prevSummary.endNetWorth;
      } else {
        summary.delta = summary.endNetWorth - summary.startNetWorth;
      }
    });

    return summaries;
  }, [projection, oneTimeEvents, recurringEvents]);

  // Determine if overall trend is positive (for gradient color)
  const isPositiveTrend = useMemo(() => {
    if (projection.points.length === 0) return true;
    const lastValue = projection.points[projection.points.length - 1].netWorth;
    const firstHistorical = historicalData.length > 0
      ? historicalData[0].netWorth
      : projection.points[0].netWorth;
    return lastValue >= firstHistorical;
  }, [historicalData, projection]);

  const chartColor = isPositiveTrend
    ? "oklch(0.72 0.19 150)" // green
    : "oklch(0.64 0.21 25)"; // red

  const formatXAxisDate = (timestamp: number) => {
    // Check if timestamp is valid
    if (!timestamp || isNaN(timestamp)) return "";
    const date = new Date(timestamp);
    // Check if date is valid
    if (isNaN(date.getTime())) return "";
    return formatPeriodLabel(date, timeScale);
  };

  // Custom X-axis tick component for year click
  const CustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const date = new Date(payload.value);
    const year = date.getFullYear();
    const isSelected = hoveredYear === year;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="middle"
          fill={isSelected ? "var(--foreground)" : "var(--muted-foreground)"}
          fontSize={12}
          fontWeight={isSelected ? 600 : 400}
          style={{ cursor: 'pointer' }}
          onClick={() => setHoveredYear(hoveredYear === year ? null : year)}
        >
          {formatXAxisDate(payload.value)}
        </text>
      </g>
    );
  };

  const formatYAxisValue = (value: number) => {
    if (privacyMode) return "***";
    return formatCompactNumber(value);
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="projectionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <YAxis
          dataKey="value"
          tickFormatter={formatYAxisValue}
          axisLine={false}
          tickLine={false}
          tick={{
            fontSize: 12,
            fill: "var(--muted-foreground)",
            opacity: privacyMode ? 0 : 1,
          }}
          domain={["auto", "auto"]}
          width={40}
        />
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={['dataMin', 'dataMax']}
          axisLine={false}
          tickLine={false}
          tick={<CustomXAxisTick />}
          scale="time"
          tickCount={8}
          minTickGap={50}
        />
        <Tooltip
          content={({ active, payload, coordinate }) => {
            // Show year breakdown tooltip if hovering over a year
            if (hoveredYear !== null) {
              const yearSummary = yearSummaries.get(hoveredYear);
              if (!yearSummary) return null;

              return (
                <div className="bg-background border-border flex flex-col gap-2 rounded-md border px-2.5 py-1.5 shadow-md max-w-sm">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <span className="text-lg font-semibold">{yearSummary.year}</span>
                  </div>

                  {/* Year-over-year change */}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground text-xs">Net worth change:</span>
                    <span className={`text-sm font-medium ${yearSummary.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {yearSummary.delta >= 0 ? "+" : ""}
                      {privacyMode ? "***" : formatCurrency(yearSummary.delta, currency)}
                    </span>
                  </div>

                  {/* Financial summary */}
                  <div className="flex flex-col gap-1 border-t pt-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground text-xs">Annual earnings:</span>
                      <span className="text-xs font-medium text-green-600">
                        +{privacyMode ? "***" : formatCurrency(yearSummary.earnings, currency)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground text-xs">Annual expenses:</span>
                      <span className="text-xs font-medium text-red-600">
                        -{privacyMode ? "***" : formatCurrency(yearSummary.expenses, currency)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground text-xs">Net savings:</span>
                      <span className={`text-xs font-medium ${yearSummary.savings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {yearSummary.savings >= 0 ? "+" : ""}
                        {privacyMode ? "***" : formatCurrency(yearSummary.savings, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Events */}
                  {yearSummary.events.length > 0 && (
                    <div className="flex flex-col gap-1 border-t pt-2">
                      <span className="text-muted-foreground text-xs font-medium">Events ({yearSummary.events.length}):</span>
                      <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                        {yearSummary.events.map((event, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              {event.emoji && <span>{event.emoji}</span>}
                              <span className="text-muted-foreground truncate">{event.description}</span>
                            </div>
                            <span className={`font-medium whitespace-nowrap ${event.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {event.amount >= 0 ? "+" : ""}
                              {privacyMode ? "***" : formatCurrency(event.amount, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (!active || !payload?.length) return null;

            const data = payload[0];

            // Check if we're hovering over a period with events
            const hoveredGroup = eventMarkerGroups.find(
              group => group.displayDate.getTime() === data.payload.timestamp
            );

            if (hoveredGroup && hoveredGroup.events.length > 0) {
              // Show events in this period
              const isProjection = data.payload.isProjection;
              const periodDescription = getPeriodDescription(hoveredGroup.periodStart, hoveredGroup.periodEnd, timeScale);

              // Find corresponding aggregated point for period summary
              const aggregatedPoint = aggregatedData.find(p =>
                p.date.getTime() === hoveredGroup.displayDate.getTime()
              );

              return (
                <div className="bg-background border-border flex flex-col gap-2 rounded-md border px-2.5 py-1.5 shadow-md max-w-sm">
                  {/* Period header */}
                  <div className="flex flex-col gap-1 border-b pb-2">
                    <span className="text-muted-foreground text-xs">
                      {periodDescription}
                      {isProjection && " (projected)"}
                    </span>
                    <span className="text-sm font-medium">
                      Net Worth: {privacyMode ? "***" : formatCurrency(Number(data.value), currency)}
                    </span>
                  </div>

                  {/* Events in this period */}
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs font-medium">
                      Events ({hoveredGroup.events.length}):
                    </span>
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {hoveredGroup.events.map((event, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            {event.emoji && <span className="text-sm">{event.emoji}</span>}
                            <span className="text-muted-foreground truncate">{event.description}</span>
                          </div>
                          <span className={`font-medium whitespace-nowrap ${event.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {event.amount >= 0 ? "+" : ""}
                            {privacyMode ? "***" : formatCurrency(event.amount, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Period summary */}
                  {aggregatedPoint && (
                    <div className="flex flex-col gap-1 border-t pt-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-muted-foreground text-xs">Period change:</span>
                        <span className={`text-xs font-medium ${aggregatedPoint.periodSummary.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {aggregatedPoint.periodSummary.totalChange >= 0 ? "+" : ""}
                          {privacyMode ? "***" : formatCurrency(aggregatedPoint.periodSummary.totalChange, currency)}
                        </span>
                      </div>
                      <div className="ml-2 flex flex-col gap-0.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Portfolio growth:</span>
                          <span className="font-medium">
                            {aggregatedPoint.periodSummary.totalPortfolioGrowth >= 0 ? "+" : ""}
                            {privacyMode ? "***" : formatCurrency(aggregatedPoint.periodSummary.totalPortfolioGrowth, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Cash flow:</span>
                          <span className="font-medium">
                            {aggregatedPoint.periodSummary.totalCashFlow >= 0 ? "+" : ""}
                            {privacyMode ? "***" : formatCurrency(aggregatedPoint.periodSummary.totalCashFlow, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Event impact:</span>
                          <span className="font-medium">
                            {aggregatedPoint.periodSummary.totalEventImpact >= 0 ? "+" : ""}
                            {privacyMode ? "***" : formatCurrency(aggregatedPoint.periodSummary.totalEventImpact, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Show regular net worth tooltip with breakdown
            const isProjection = data.payload.isProjection;
            const periodDescription = getPeriodDescription(
              data.payload.date,
              data.payload.date,
              timeScale
            );

            // Find aggregated point for period summary
            const aggregatedPoint = aggregatedData.find(p =>
              p.date.getTime() === data.payload.timestamp
            );

            return (
              <div className="bg-background border-border flex flex-col gap-2 rounded-md border px-2.5 py-1.5 shadow-md">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">
                    {periodDescription}
                    {isProjection && " (projected)"}
                  </span>
                  <span className="text-sm font-medium">
                    Net Worth: {privacyMode ? "***" : formatCurrency(Number(data.value), currency)}
                  </span>
                </div>

                {/* Period change breakdown */}
                {aggregatedPoint && (
                  <div className="flex flex-col gap-1 border-t pt-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground text-xs">Period change:</span>
                      <span className={`text-xs font-medium ${aggregatedPoint.periodSummary.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {aggregatedPoint.periodSummary.totalChange >= 0 ? "+" : ""}
                        {privacyMode ? "***" : formatCurrency(aggregatedPoint.periodSummary.totalChange, currency)}
                      </span>
                    </div>
                    {/* Breakdown items */}
                    <div className="ml-2 flex flex-col gap-0.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">├─ Portfolio growth:</span>
                        <span className="font-medium">
                          {aggregatedPoint.periodSummary.totalPortfolioGrowth >= 0 ? "+" : ""}
                          {privacyMode ? "***" : formatCurrency(aggregatedPoint.periodSummary.totalPortfolioGrowth, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">├─ Cash flow:</span>
                        <span className="font-medium">
                          {aggregatedPoint.periodSummary.totalCashFlow >= 0 ? "+" : ""}
                          {privacyMode ? "***" : formatCurrency(aggregatedPoint.periodSummary.totalCashFlow, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">└─ Event impact:</span>
                        <span className="font-medium">
                          {aggregatedPoint.periodSummary.totalEventImpact >= 0 ? "+" : ""}
                          {privacyMode ? "***" : formatCurrency(aggregatedPoint.periodSummary.totalEventImpact, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }}
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
        />
        <Area
          dataKey="value"
          stroke={chartColor}
          strokeWidth={1.5}
          fill="url(#projectionGradient)"
          fillOpacity={1}
          dot={false}
          activeDot={{
            r: 4.5,
            strokeWidth: 2.5,
            filter: "drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.3))",
          }}
        />

        {/* Event marker groups - horizontally stacked */}
        {eventMarkerGroups.map((group, groupIndex) => {
          return group.events.map((event, eventIndex) => {
            const isDisabled = !event.enabled;
            const opacity = isDisabled ? 0.3 : 1;

            // Horizontal offset for stacking (12px spacing)
            const horizontalOffset = eventIndex * 12 - (group.events.length - 1) * 6;

            return (
              <ReferenceDot
                key={`${groupIndex}-${eventIndex}`}
                x={group.displayDate.getTime()}
                y={group.netWorthAtPeriod}
                r={0}
                fill="transparent"
                stroke="transparent"
                style={{ cursor: 'pointer' }}
                shape={(props: any) => {
                  const { cx, cy } = props;
                  const adjustedCx = cx + horizontalOffset;

                  return (
                    <g
                      style={{ pointerEvents: 'all', opacity }}
                      onClick={() => onToggleEvent?.(event.id, event.eventType)}
                    >
                      {event.emoji ? (
                        <text
                          x={adjustedCx}
                          y={cy - 10}
                          textAnchor="middle"
                          fontSize="18"
                          style={{ cursor: 'pointer' }}
                        >
                          {event.emoji}
                        </text>
                      ) : (
                        <circle
                          cx={adjustedCx}
                          cy={cy}
                          r={5}
                          fill={event.amount < 0 ? "oklch(0.64 0.21 25)" : "oklch(0.72 0.19 150)"}
                          stroke="var(--background)"
                          strokeWidth={2}
                          style={{ cursor: 'pointer' }}
                        />
                      )}
                      {/* Show a strikethrough line for disabled events */}
                      {isDisabled && (
                        <line
                          x1={adjustedCx - 10}
                          y1={cy - 10}
                          x2={adjustedCx + 10}
                          y2={cy - 10}
                          stroke="var(--destructive)"
                          strokeWidth={2}
                          opacity={0.8}
                        />
                      )}
                    </g>
                  );
                }}
              />
            );
          });
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}
