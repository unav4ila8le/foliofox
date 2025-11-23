/**
 * Projection Analytics
 *
 * Calculate insights and statistics from financial projections
 */

import type { ProjectionResult, OneTimeEvent, RecurringEvent, CategoryAssumption } from "./planning-engine";
import { aggregateProjection, type TimeScale } from "./projection-aggregation";

// ============================================================================
// Types
// ============================================================================

export interface ProjectionAnalytics {
  portfolioGrowth: PortfolioGrowthMetrics;
  events: EventAnalytics;
  cashFlow: CashFlowMetrics;
  categories: CategoryBreakdown;
}

export interface PortfolioGrowthMetrics {
  startingNetWorth: number;
  endingNetWorth: number;
  totalGrowthDollar: number;
  totalGrowthPercent: number;
  cagr: number; // Compound Annual Growth Rate
  yearlyMetrics: YearlyMetric[];
  summary: {
    averageAnnualIncrease: number;
    maxAnnualIncrease: number;
    minAnnualIncrease: number;
    averageAnnualReturn: number;
    maxAnnualReturn: number;
    minAnnualReturn: number;
    bestYear: { year: number; increase: number; return: number };
    worstYear: { year: number; increase: number; return: number };
  };
}

export interface YearlyMetric {
  year: number;
  startDate: Date;
  endDate: Date;
  startingNetWorth: number;
  endingNetWorth: number;
  annualIncrease: number;
  annualReturn: number; // percentage
  portfolioGrowth: number;
  cashFlow: number;
  eventImpact: number;
}

export interface EventAnalytics {
  topPositive: RankedEvent[];
  topNegative: RankedEvent[];
  totalEventImpact: number;
  eventCount: number;
  byType: Record<string, EventGrouping>;
  byTag: Record<string, EventGrouping>;
  largestSingleEvent: RankedEvent | null;
}

export interface RankedEvent {
  event: OneTimeEvent | RecurringEvent;
  impact: number;
  date: Date;
  type: 'one-time' | 'recurring';
  tags: string[];
  eventType: string | undefined; // from metadata.type
}

export interface EventGrouping {
  count: number;
  totalImpact: number;
  averageImpact: number;
  events: RankedEvent[];
}

export interface CashFlowMetrics {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRate: number; // percentage
  yearlyBreakdown: YearlyCashFlow[];
  averageAnnualIncome: number;
  averageAnnualExpenses: number;
}

export interface YearlyCashFlow {
  year: number;
  income: number;
  expenses: number;
  netCashFlow: number;
  savingsRate: number;
}

export interface CategoryBreakdown {
  categories: CategoryMetric[];
  topPerformer: { categoryName: string; return: number } | null;
  mostGrowth: { categoryName: string; growth: number } | null;
}

export interface CategoryMetric {
  categoryId: string;
  categoryName: string;
  startingValue: number;
  endingValue: number;
  totalGrowth: number;
  totalGrowthPercent: number;
  annualReturn: number;
  allocationStart: number; // percentage
  allocationEnd: number; // percentage
}

// ============================================================================
// Main Analytics Generator
// ============================================================================

export function generateProjectionAnalytics(
  projection: ProjectionResult,
  oneTimeEvents: OneTimeEvent[],
  recurringEvents: RecurringEvent[],
  categoryAssumptions: CategoryAssumption[]
): ProjectionAnalytics {
  return {
    portfolioGrowth: calculatePortfolioGrowthMetrics(projection),
    events: calculateEventAnalytics(oneTimeEvents, recurringEvents, projection),
    cashFlow: calculateCashFlowMetrics(projection),
    categories: calculateCategoryBreakdown(projection, categoryAssumptions),
  };
}

// ============================================================================
// Portfolio Growth Calculations
// ============================================================================

export function calculatePortfolioGrowthMetrics(
  projection: ProjectionResult
): PortfolioGrowthMetrics {
  const points = projection.points;
  if (points.length === 0) {
    return createEmptyPortfolioMetrics();
  }

  const startingNetWorth = points[0].netWorth;
  const endingNetWorth = points[points.length - 1].netWorth;
  const totalGrowthDollar = endingNetWorth - startingNetWorth;
  const totalGrowthPercent = startingNetWorth !== 0
    ? (totalGrowthDollar / startingNetWorth) * 100
    : 0;

  // Calculate CAGR
  const years = points.length / 12; // Assuming monthly data
  const cagr = startingNetWorth !== 0 && years > 0
    ? (Math.pow(endingNetWorth / startingNetWorth, 1 / years) - 1) * 100
    : 0;

  // Calculate yearly metrics
  const yearlyMetrics = calculateYearlyMetrics(points);

  // Calculate summary statistics
  const annualIncreases = yearlyMetrics.map(y => y.annualIncrease);
  const annualReturns = yearlyMetrics.map(y => y.annualReturn);

  const summary = {
    averageAnnualIncrease: average(annualIncreases),
    maxAnnualIncrease: Math.max(...annualIncreases),
    minAnnualIncrease: Math.min(...annualIncreases),
    averageAnnualReturn: average(annualReturns),
    maxAnnualReturn: Math.max(...annualReturns),
    minAnnualReturn: Math.min(...annualReturns),
    bestYear: findBestYear(yearlyMetrics),
    worstYear: findWorstYear(yearlyMetrics),
  };

  return {
    startingNetWorth,
    endingNetWorth,
    totalGrowthDollar,
    totalGrowthPercent,
    cagr,
    yearlyMetrics,
    summary,
  };
}

function calculateYearlyMetrics(points: ProjectionResult['points']): YearlyMetric[] {
  if (points.length === 0) return [];

  // Aggregate to yearly data
  const yearlyData = aggregateProjection(points, 'yearly');
  const metrics: YearlyMetric[] = [];

  for (let i = 0; i < yearlyData.length; i++) {
    const currentYear = yearlyData[i];
    const previousYear = i > 0 ? yearlyData[i - 1] : null;

    const startingNetWorth = previousYear?.netWorth || points[0].netWorth;
    const endingNetWorth = currentYear.netWorth;
    const annualIncrease = endingNetWorth - startingNetWorth;
    const annualReturn = startingNetWorth !== 0
      ? (annualIncrease / startingNetWorth) * 100
      : 0;

    metrics.push({
      year: currentYear.date.getFullYear(),
      startDate: currentYear.periodStart,
      endDate: currentYear.periodEnd,
      startingNetWorth,
      endingNetWorth,
      annualIncrease,
      annualReturn,
      portfolioGrowth: currentYear.periodSummary.totalPortfolioGrowth,
      cashFlow: currentYear.periodSummary.totalCashFlow,
      eventImpact: currentYear.periodSummary.totalEventImpact,
    });
  }

  return metrics;
}

function findBestYear(yearlyMetrics: YearlyMetric[]): { year: number; increase: number; return: number } {
  if (yearlyMetrics.length === 0) return { year: 0, increase: 0, return: 0 };

  const best = yearlyMetrics.reduce((max, current) =>
    current.annualReturn > max.annualReturn ? current : max
  );

  return {
    year: best.year,
    increase: best.annualIncrease,
    return: best.annualReturn,
  };
}

function findWorstYear(yearlyMetrics: YearlyMetric[]): { year: number; increase: number; return: number } {
  if (yearlyMetrics.length === 0) return { year: 0, increase: 0, return: 0 };

  const worst = yearlyMetrics.reduce((min, current) =>
    current.annualReturn < min.annualReturn ? current : min
  );

  return {
    year: worst.year,
    increase: worst.annualIncrease,
    return: worst.annualReturn,
  };
}

// ============================================================================
// Event Analytics
// ============================================================================

export function calculateEventAnalytics(
  oneTimeEvents: OneTimeEvent[],
  recurringEvents: RecurringEvent[],
  projection: ProjectionResult
): EventAnalytics {
  // Collect all events with their impacts
  const allEvents: RankedEvent[] = [];

  // Process one-time events
  oneTimeEvents.forEach(event => {
    if (event.enabled === false) return; // Skip disabled events

    allEvents.push({
      event,
      impact: event.amount,
      date: event.date,
      type: 'one-time',
      tags: event.tags || [],
      eventType: event.metadata?.type as string | undefined,
    });
  });

  // Process recurring events (estimate total impact)
  recurringEvents.forEach(event => {
    if (event.enabled === false) return; // Skip disabled events

    // Calculate occurrences
    const occurrences = estimateEventOccurrences(event, projection);
    const totalImpact = event.amount * occurrences;

    allEvents.push({
      event,
      impact: totalImpact,
      date: event.startDate,
      type: 'recurring',
      tags: event.tags || [],
      eventType: event.metadata?.type as string | undefined,
    });
  });

  // Sort by absolute impact
  const sortedByImpact = [...allEvents].sort((a, b) =>
    Math.abs(b.impact) - Math.abs(a.impact)
  );

  // Top positive (income)
  const topPositive = allEvents
    .filter(e => e.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5);

  // Top negative (expenses)
  const topNegative = allEvents
    .filter(e => e.impact < 0)
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 5);

  // Group by type and tag
  const byType = groupEventsByType(allEvents);
  const byTag = groupEventsByTag(allEvents);

  // Total impact and count
  const totalEventImpact = allEvents.reduce((sum, e) => sum + e.impact, 0);
  const eventCount = allEvents.length;

  return {
    topPositive,
    topNegative,
    totalEventImpact,
    eventCount,
    byType,
    byTag,
    largestSingleEvent: sortedByImpact[0] || null,
  };
}

function estimateEventOccurrences(event: RecurringEvent, projection: ProjectionResult): number {
  const points = projection.points;
  if (points.length === 0) return 0;

  const start = event.startDate.getTime();
  const end = event.endDate ? event.endDate.getTime() : points[points.length - 1].date.getTime();
  const duration = end - start;
  const durationInMonths = duration / (1000 * 60 * 60 * 24 * 30);

  switch (event.frequency) {
    case 'monthly':
      return Math.ceil(durationInMonths);
    case 'quarterly':
      return Math.ceil(durationInMonths / 3);
    case 'yearly':
      return Math.ceil(durationInMonths / 12);
    default:
      return 0;
  }
}

function groupEventsByType(events: RankedEvent[]): Record<string, EventGrouping> {
  const groups: Record<string, EventGrouping> = {};

  events.forEach(rankedEvent => {
    const type = rankedEvent.eventType || 'other';

    if (!groups[type]) {
      groups[type] = {
        count: 0,
        totalImpact: 0,
        averageImpact: 0,
        events: [],
      };
    }

    groups[type].count++;
    groups[type].totalImpact += rankedEvent.impact;
    groups[type].events.push(rankedEvent);
  });

  // Calculate averages
  Object.values(groups).forEach(group => {
    group.averageImpact = group.count > 0 ? group.totalImpact / group.count : 0;
  });

  return groups;
}

function groupEventsByTag(events: RankedEvent[]): Record<string, EventGrouping> {
  const groups: Record<string, EventGrouping> = {};

  events.forEach(rankedEvent => {
    const tags = rankedEvent.tags.length > 0 ? rankedEvent.tags : ['untagged'];

    tags.forEach(tag => {
      if (!groups[tag]) {
        groups[tag] = {
          count: 0,
          totalImpact: 0,
          averageImpact: 0,
          events: [],
        };
      }

      groups[tag].count++;
      groups[tag].totalImpact += rankedEvent.impact;
      groups[tag].events.push(rankedEvent);
    });
  });

  // Calculate averages
  Object.values(groups).forEach(group => {
    group.averageImpact = group.count > 0 ? group.totalImpact / group.count : 0;
  });

  return groups;
}

// ============================================================================
// Cash Flow Calculations
// ============================================================================

export function calculateCashFlowMetrics(projection: ProjectionResult): CashFlowMetrics {
  const points = projection.points;
  const yearlyData = aggregateProjection(points, 'yearly');

  let totalIncome = 0;
  let totalExpenses = 0;

  const yearlyBreakdown: YearlyCashFlow[] = yearlyData.map(year => {
    // Income is positive cash flow, expenses are negative
    const income = year.periodSummary.totalCashFlow > 0 ? year.periodSummary.totalCashFlow : 0;
    const expenses = year.periodSummary.totalCashFlow < 0 ? Math.abs(year.periodSummary.totalCashFlow) : 0;

    totalIncome += income;
    totalExpenses += expenses;

    const netCashFlow = year.periodSummary.totalCashFlow;
    const savingsRate = income > 0 ? (netCashFlow / income) * 100 : 0;

    return {
      year: year.date.getFullYear(),
      income,
      expenses,
      netCashFlow,
      savingsRate,
    };
  });

  const netCashFlow = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netCashFlow / totalIncome) * 100 : 0;
  const years = yearlyBreakdown.length || 1;

  return {
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate,
    yearlyBreakdown,
    averageAnnualIncome: totalIncome / years,
    averageAnnualExpenses: totalExpenses / years,
  };
}

// ============================================================================
// Category Breakdown
// ============================================================================

export function calculateCategoryBreakdown(
  projection: ProjectionResult,
  categoryAssumptions: CategoryAssumption[]
): CategoryBreakdown {
  const points = projection.points;
  if (points.length === 0 || categoryAssumptions.length === 0) {
    return { categories: [], topPerformer: null, mostGrowth: null };
  }

  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const years = points.length / 12;

  const categories: CategoryMetric[] = categoryAssumptions.map(cat => {
    const startingValue = cat.currentValue;
    const endingValue = endPoint.portfolioValueByCategory[cat.categoryId] || 0;
    const totalGrowth = endingValue - startingValue;
    const totalGrowthPercent = startingValue !== 0
      ? (totalGrowth / startingValue) * 100
      : 0;

    const annualReturn = startingValue !== 0 && years > 0
      ? (Math.pow(endingValue / startingValue, 1 / years) - 1) * 100
      : 0;

    const totalStartPortfolio = Object.values(startPoint.portfolioValueByCategory)
      .reduce((sum, val) => sum + val, 0);
    const totalEndPortfolio = Object.values(endPoint.portfolioValueByCategory)
      .reduce((sum, val) => sum + val, 0);

    const allocationStart = totalStartPortfolio > 0
      ? (startingValue / totalStartPortfolio) * 100
      : 0;
    const allocationEnd = totalEndPortfolio > 0
      ? (endingValue / totalEndPortfolio) * 100
      : 0;

    return {
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      startingValue,
      endingValue,
      totalGrowth,
      totalGrowthPercent,
      annualReturn,
      allocationStart,
      allocationEnd,
    };
  });

  // Find top performer (highest return)
  const topPerformer = categories.length > 0
    ? categories.reduce((max, cat) => cat.annualReturn > max.annualReturn ? cat : max)
    : null;

  // Find most growth (highest dollar growth)
  const mostGrowth = categories.length > 0
    ? categories.reduce((max, cat) => cat.totalGrowth > max.totalGrowth ? cat : max)
    : null;

  return {
    categories,
    topPerformer: topPerformer ? {
      categoryName: topPerformer.categoryName,
      return: topPerformer.annualReturn,
    } : null,
    mostGrowth: mostGrowth ? {
      categoryName: mostGrowth.categoryName,
      growth: mostGrowth.totalGrowth,
    } : null,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function createEmptyPortfolioMetrics(): PortfolioGrowthMetrics {
  return {
    startingNetWorth: 0,
    endingNetWorth: 0,
    totalGrowthDollar: 0,
    totalGrowthPercent: 0,
    cagr: 0,
    yearlyMetrics: [],
    summary: {
      averageAnnualIncrease: 0,
      maxAnnualIncrease: 0,
      minAnnualIncrease: 0,
      averageAnnualReturn: 0,
      maxAnnualReturn: 0,
      minAnnualReturn: 0,
      bestYear: { year: 0, increase: 0, return: 0 },
      worstYear: { year: 0, increase: 0, return: 0 },
    },
  };
}
