/**
 * Projection Data Aggregation
 *
 * Utilities for aggregating monthly projection data into different time scales
 * (daily, monthly, quarterly, yearly) for better visualization.
 */

import {
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  isSameQuarter,
  isSameYear,
  isSameMonth,
  format
} from "date-fns";

import type { ProjectionPoint, OneTimeEvent, RecurringEvent } from "./planning-engine";

export type TimeScale = 'monthly' | 'quarterly' | 'yearly';

export interface AggregatedProjectionPoint {
  date: Date; // End of period
  periodStart: Date;
  periodEnd: Date;
  netWorth: number;
  cashBalance: number;
  portfolioValueByCategory: Record<string, number>;
  totalPortfolioValue: number;

  // Aggregated events in this period
  events: Array<{
    date: Date; // Original event date
    type: 'one-time' | 'recurring' | 'sale';
    description: string;
    amount?: number;
  }>;

  // Summary for the period
  periodSummary: {
    totalChange: number;
    totalPortfolioGrowth: number;
    totalCashFlow: number;
    totalEventImpact: number;
    eventCount: number;
  };
}

/**
 * Aggregate monthly projection data into larger time periods
 */
export function aggregateProjection(
  monthlyPoints: ProjectionPoint[],
  scale: TimeScale
): AggregatedProjectionPoint[] {
  if (scale === 'monthly') {
    // For monthly scale, just convert to aggregated format
    return monthlyPoints.map(point => ({
      date: point.date,
      periodStart: startOfMonth(point.date),
      periodEnd: endOfMonth(point.date),
      netWorth: point.netWorth,
      cashBalance: point.cashBalance,
      portfolioValueByCategory: point.portfolioValueByCategory,
      totalPortfolioValue: point.totalPortfolioValue,
      events: point.events,
      periodSummary: {
        totalChange: point.monthlyChange?.total || 0,
        totalPortfolioGrowth: point.monthlyChange?.portfolioGrowth || 0,
        totalCashFlow: point.monthlyChange?.cashFlow || 0,
        totalEventImpact: point.monthlyChange?.eventImpact || 0,
        eventCount: point.events.length,
      },
    }));
  }

  const aggregated: AggregatedProjectionPoint[] = [];
  const periods = new Map<string, {
    points: ProjectionPoint[];
    periodStart: Date;
    periodEnd: Date;
  }>();

  // Group points by period
  monthlyPoints.forEach(point => {
    let periodKey: string;
    let periodStart: Date;
    let periodEnd: Date;

    if (scale === 'quarterly') {
      periodStart = startOfQuarter(point.date);
      periodEnd = endOfQuarter(point.date);
      periodKey = format(periodStart, 'yyyy-QQQ');
    } else { // yearly
      periodStart = startOfYear(point.date);
      periodEnd = endOfYear(point.date);
      periodKey = format(periodStart, 'yyyy');
    }

    if (!periods.has(periodKey)) {
      periods.set(periodKey, {
        points: [],
        periodStart,
        periodEnd,
      });
    }

    periods.get(periodKey)!.points.push(point);
  });

  // Create aggregated points (end-of-period snapshot)
  Array.from(periods.values()).forEach(period => {
    const lastPoint = period.points[period.points.length - 1];
    const firstPoint = period.points[0];

    // Collect all events in this period
    const allEvents: AggregatedProjectionPoint['events'] = [];
    period.points.forEach(point => {
      point.events.forEach(event => {
        allEvents.push({
          date: point.date,
          type: event.type,
          description: event.description,
          amount: event.amount,
        });
      });
    });

    // Calculate period summary
    let totalChange = 0;
    let totalPortfolioGrowth = 0;
    let totalCashFlow = 0;
    let totalEventImpact = 0;

    period.points.forEach(point => {
      if (point.monthlyChange) {
        totalPortfolioGrowth += point.monthlyChange.portfolioGrowth;
        totalCashFlow += point.monthlyChange.cashFlow;
        totalEventImpact += point.monthlyChange.eventImpact;
      }
    });

    totalChange = lastPoint.netWorth - firstPoint.netWorth;

    aggregated.push({
      date: period.periodEnd,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      netWorth: lastPoint.netWorth,
      cashBalance: lastPoint.cashBalance,
      portfolioValueByCategory: lastPoint.portfolioValueByCategory,
      totalPortfolioValue: lastPoint.totalPortfolioValue,
      events: allEvents,
      periodSummary: {
        totalChange,
        totalPortfolioGrowth,
        totalCashFlow,
        totalEventImpact,
        eventCount: allEvents.length,
      },
    });
  });

  return aggregated.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Group events by time period for marker display
 */
export interface EventMarkerGroup {
  periodStart: Date;
  periodEnd: Date;
  displayDate: Date; // Date to use for positioning on chart
  events: Array<{
    id: string;
    date: Date;
    description: string;
    amount: number;
    emoji?: string;
    type: 'one-time' | 'recurring';
    eventType: 'one-time' | 'recurring';
    enabled: boolean;
  }>;
  netWorthAtPeriod: number;
}

/**
 * Group event markers by time period based on scale
 */
export function groupEventMarkers(
  events: Array<{
    id: string;
    date: Date;
    description: string;
    amount: number;
    emoji?: string;
    type: 'one-time' | 'recurring';
    eventType: 'one-time' | 'recurring';
    enabled: boolean;
  }>,
  aggregatedPoints: AggregatedProjectionPoint[],
  scale: TimeScale
): EventMarkerGroup[] {
  const groups = new Map<string, EventMarkerGroup>();

  events.forEach(event => {
    let periodKey: string;
    let periodStart: Date;
    let periodEnd: Date;

    if (scale === 'monthly') {
      periodStart = startOfMonth(event.date);
      periodEnd = endOfMonth(event.date);
      periodKey = format(periodStart, 'yyyy-MM');
    } else if (scale === 'quarterly') {
      periodStart = startOfQuarter(event.date);
      periodEnd = endOfQuarter(event.date);
      periodKey = format(periodStart, 'yyyy-QQQ');
    } else { // yearly
      periodStart = startOfYear(event.date);
      periodEnd = endOfYear(event.date);
      periodKey = format(periodStart, 'yyyy');
    }

    // Find the corresponding aggregated point
    const point = aggregatedPoints.find(p =>
      p.date >= periodStart && p.date <= periodEnd
    );

    if (!groups.has(periodKey)) {
      groups.set(periodKey, {
        periodStart,
        periodEnd,
        displayDate: point?.date || periodEnd, // Use exact aggregated point date
        events: [],
        netWorthAtPeriod: point?.netWorth || 0,
      });
    }

    groups.get(periodKey)!.events.push(event);
  });

  return Array.from(groups.values()).sort(
    (a, b) => a.displayDate.getTime() - b.displayDate.getTime()
  );
}

/**
 * Format period label based on scale
 */
export function formatPeriodLabel(date: Date, scale: TimeScale): string {
  switch (scale) {
    case 'monthly':
      return format(date, 'MMM yyyy');
    case 'quarterly':
      return format(date, 'QQQ yyyy');
    case 'yearly':
      return format(date, 'yyyy');
    default:
      return format(date, 'MMM yyyy');
  }
}

/**
 * Get period description for tooltips
 */
export function getPeriodDescription(
  periodStart: Date,
  periodEnd: Date,
  scale: TimeScale
): string {
  switch (scale) {
    case 'monthly':
      return format(periodStart, 'MMMM yyyy');
    case 'quarterly':
      return `Q${Math.floor(periodStart.getMonth() / 3) + 1} ${periodStart.getFullYear()}`;
    case 'yearly':
      return periodStart.getFullYear().toString();
    default:
      return format(periodStart, 'MMMM yyyy');
  }
}
