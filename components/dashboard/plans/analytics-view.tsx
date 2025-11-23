"use client";

import type { ProjectionAnalytics } from "@/lib/projection-analytics";
import { formatCurrency } from "@/lib/number-format";
import { AnalyticsMetricCard } from "./analytics-metric-card";
import { AnalyticsEventList } from "./analytics-event-list";
import { AnalyticsYearTable } from "./analytics-year-table";

interface AnalyticsViewProps {
  analytics: ProjectionAnalytics | null;
  currency?: string;
}

export function AnalyticsView({ analytics, currency = "USD" }: AnalyticsViewProps) {
  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  const { portfolioGrowth, events, cashFlow, categories } = analytics;

  return (
    <div className="space-y-6 py-4">
      {/* Summary Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Net Worth Growth */}
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-1">Total Net Worth Growth</p>
          <p className="text-2xl font-bold">
            {formatCurrency(portfolioGrowth.totalGrowthDollar, currency)}
          </p>
          <p className={`text-sm mt-1 ${
            portfolioGrowth.totalGrowthPercent >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {portfolioGrowth.totalGrowthPercent >= 0 ? '+' : ''}
            {portfolioGrowth.totalGrowthPercent.toFixed(2)}%
          </p>
        </div>

        {/* CAGR */}
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-1">Compound Annual Growth Rate</p>
          <p className="text-2xl font-bold">
            {portfolioGrowth.cagr >= 0 ? '+' : ''}
            {portfolioGrowth.cagr.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            CAGR over {portfolioGrowth.yearlyMetrics.length} years
          </p>
        </div>

        {/* Net Cash Flow */}
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-1">Net Cash Flow</p>
          <p className="text-2xl font-bold">
            {formatCurrency(cashFlow.netCashFlow, currency)}
          </p>
          <p className={`text-sm mt-1 ${
            cashFlow.savingsRate >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {cashFlow.savingsRate.toFixed(1)}% savings rate
          </p>
        </div>

        {/* Total Events */}
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-1">Life Events</p>
          <p className="text-2xl font-bold">{events.eventCount}</p>
          <p className={`text-sm mt-1 ${
            events.totalEventImpact >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {events.totalEventImpact >= 0 ? '+' : ''}
            {formatCurrency(events.totalEventImpact, currency)} total impact
          </p>
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Portfolio Growth Metrics */}
        <AnalyticsMetricCard
          title="📈 Portfolio Growth Metrics"
          trend={portfolioGrowth.totalGrowthPercent >= 0 ? 'up' : 'down'}
          summary={
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Starting Net Worth:</span>
                <span className="font-semibold">
                  {formatCurrency(portfolioGrowth.startingNetWorth, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ending Net Worth:</span>
                <span className="font-semibold">
                  {formatCurrency(portfolioGrowth.endingNetWorth, currency)}
                </span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Annual Increase:</span>
                  <span className="font-semibold">
                    {formatCurrency(portfolioGrowth.summary.averageAnnualIncrease, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Avg Annual Return:</span>
                  <span className="font-semibold">
                    {portfolioGrowth.summary.averageAnnualReturn.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          }
          details={
            <div className="space-y-3">
              {/* Best/Worst Year */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 rounded-md bg-green-50 border border-green-200">
                  <p className="text-xs text-green-700 font-medium mb-1">Best Year</p>
                  <p className="text-sm font-semibold">{portfolioGrowth.summary.bestYear.year}</p>
                  <p className="text-xs text-green-600">
                    +{portfolioGrowth.summary.bestYear.return.toFixed(2)}%
                  </p>
                </div>
                <div className="p-2 rounded-md bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700 font-medium mb-1">Worst Year</p>
                  <p className="text-sm font-semibold">{portfolioGrowth.summary.worstYear.year}</p>
                  <p className="text-xs text-red-600">
                    {portfolioGrowth.summary.worstYear.return.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Year-by-year table */}
              <div>
                <h5 className="text-xs font-semibold mb-2">Year-by-Year Breakdown</h5>
                <AnalyticsYearTable
                  yearlyMetrics={portfolioGrowth.yearlyMetrics}
                  currency={currency}
                />
              </div>
            </div>
          }
        />

        {/* Event Analytics */}
        <AnalyticsMetricCard
          title="🎯 Event Analytics"
          summary={
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Events:</span>
                <span className="font-semibold">{events.eventCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Impact:</span>
                <span className={`font-semibold ${
                  events.totalEventImpact >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {events.totalEventImpact >= 0 ? '+' : ''}
                  {formatCurrency(events.totalEventImpact, currency)}
                </span>
              </div>
              {events.largestSingleEvent && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Largest Single Event:</p>
                  <p className="text-sm font-medium truncate">
                    {events.largestSingleEvent.event.emoji} {events.largestSingleEvent.event.description}
                  </p>
                  <p className={`text-sm font-semibold ${
                    events.largestSingleEvent.impact >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {events.largestSingleEvent.impact >= 0 ? '+' : ''}
                    {formatCurrency(Math.abs(events.largestSingleEvent.impact), currency)}
                  </p>
                </div>
              )}
            </div>
          }
          details={
            <div className="space-y-4">
              {/* Top Positive Events */}
              {events.topPositive.length > 0 && (
                <div>
                  <AnalyticsEventList
                    events={events.topPositive}
                    currency={currency}
                    title="Top Income Events"
                    emptyMessage="No income events"
                  />
                </div>
              )}

              {/* Top Negative Events */}
              {events.topNegative.length > 0 && (
                <div>
                  <AnalyticsEventList
                    events={events.topNegative}
                    currency={currency}
                    title="Top Expense Events"
                    emptyMessage="No expense events"
                  />
                </div>
              )}

              {/* Event Grouping by Type */}
              {Object.keys(events.byType).length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold mb-2">Events by Type</h5>
                  <div className="space-y-1">
                    {Object.entries(events.byType)
                      .sort(([, a], [, b]) => Math.abs(b.totalImpact) - Math.abs(a.totalImpact))
                      .map(([type, group]) => (
                        <div key={type} className="flex justify-between text-sm p-2 rounded border bg-background">
                          <span className="capitalize">{type.replace('-', ' ')}</span>
                          <div className="text-right">
                            <span className={`font-semibold ${
                              group.totalImpact >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {group.totalImpact >= 0 ? '+' : ''}
                              {formatCurrency(group.totalImpact, currency)}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({group.count} events)
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          }
        />

        {/* Cash Flow Analysis */}
        <AnalyticsMetricCard
          title="💰 Cash Flow Analysis"
          trend={cashFlow.netCashFlow >= 0 ? 'up' : 'down'}
          summary={
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Income:</span>
                <span className="font-semibold text-green-600">
                  +{formatCurrency(cashFlow.totalIncome, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Expenses:</span>
                <span className="font-semibold text-red-600">
                  -{formatCurrency(cashFlow.totalExpenses, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">Net Cash Flow:</span>
                <span className={`font-semibold ${
                  cashFlow.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {cashFlow.netCashFlow >= 0 ? '+' : ''}
                  {formatCurrency(cashFlow.netCashFlow, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Savings Rate:</span>
                <span className="font-semibold">
                  {cashFlow.savingsRate.toFixed(1)}%
                </span>
              </div>
            </div>
          }
          details={
            <div className="space-y-3">
              <div>
                <h5 className="text-xs font-semibold mb-2">Annual Breakdown</h5>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">Year</th>
                        <th className="px-2 py-1 text-right font-medium">Income</th>
                        <th className="px-2 py-1 text-right font-medium">Expenses</th>
                        <th className="px-2 py-1 text-right font-medium">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {cashFlow.yearlyBreakdown.map((year, index) => (
                        <tr key={year.year} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="px-2 py-1">{year.year}</td>
                          <td className="px-2 py-1 text-right text-green-600 font-mono text-xs">
                            +{formatCurrency(year.income, currency)}
                          </td>
                          <td className="px-2 py-1 text-right text-red-600 font-mono text-xs">
                            -{formatCurrency(year.expenses, currency)}
                          </td>
                          <td className={`px-2 py-1 text-right font-mono text-xs ${
                            year.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {year.netCashFlow >= 0 ? '+' : ''}
                            {formatCurrency(year.netCashFlow, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          }
        />

        {/* Category Breakdown */}
        <AnalyticsMetricCard
          title="📊 Category Breakdown"
          summary={
            <div className="space-y-2">
              {categories.topPerformer && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Top Performer:</span>
                  <div className="text-right">
                    <p className="font-semibold">{categories.topPerformer.categoryName}</p>
                    <p className="text-xs text-green-600">
                      {categories.topPerformer.return.toFixed(2)}% annual return
                    </p>
                  </div>
                </div>
              )}
              {categories.mostGrowth && (
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Most Growth:</span>
                  <div className="text-right">
                    <p className="font-semibold">{categories.mostGrowth.categoryName}</p>
                    <p className="text-xs text-green-600">
                      +{formatCurrency(categories.mostGrowth.growth, currency)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          }
          details={
            <div className="space-y-3">
              <h5 className="text-xs font-semibold">Per-Category Returns</h5>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Category</th>
                      <th className="px-2 py-1 text-right font-medium">Start</th>
                      <th className="px-2 py-1 text-right font-medium">End</th>
                      <th className="px-2 py-1 text-right font-medium">Growth</th>
                      <th className="px-2 py-1 text-right font-medium">Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {categories.categories.map((cat, index) => (
                      <tr key={cat.categoryId} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="px-2 py-1 font-medium truncate max-w-[100px]">
                          {cat.categoryName}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-xs">
                          {formatCurrency(cat.startingValue, currency)}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-xs">
                          {formatCurrency(cat.endingValue, currency)}
                        </td>
                        <td className={`px-2 py-1 text-right font-mono text-xs ${
                          cat.totalGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {cat.totalGrowth >= 0 ? '+' : ''}
                          {cat.totalGrowthPercent.toFixed(1)}%
                        </td>
                        <td className={`px-2 py-1 text-right font-mono text-xs ${
                          cat.annualReturn >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {cat.annualReturn >= 0 ? '+' : ''}
                          {cat.annualReturn.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
