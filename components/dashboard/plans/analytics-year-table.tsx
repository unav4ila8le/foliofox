"use client";

import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import type { YearlyMetric } from "@/lib/projection-analytics";
import { formatCurrency } from "@/lib/number-format";

interface AnalyticsYearTableProps {
  yearlyMetrics: YearlyMetric[];
  currency?: string;
}

type SortKey = 'year' | 'endingNetWorth' | 'annualIncrease' | 'annualReturn';
type SortDirection = 'asc' | 'desc';

export function AnalyticsYearTable({
  yearlyMetrics,
  currency = "USD",
}: AnalyticsYearTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('year');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  if (yearlyMetrics.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No yearly data available
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc'); // Default to descending for new columns
    }
  };

  const sortedMetrics = [...yearlyMetrics].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const direction = sortDirection === 'asc' ? 1 : -1;
    return aVal < bVal ? -direction : aVal > bVal ? direction : 0;
  });

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                <button
                  onClick={() => handleSort('year')}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  Year
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <button
                  onClick={() => handleSort('endingNetWorth')}
                  className="flex items-center justify-end gap-1 w-full hover:text-primary transition-colors"
                >
                  Ending Net Worth
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <button
                  onClick={() => handleSort('annualIncrease')}
                  className="flex items-center justify-end gap-1 w-full hover:text-primary transition-colors"
                >
                  Annual Change
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <button
                  onClick={() => handleSort('annualReturn')}
                  className="flex items-center justify-end gap-1 w-full hover:text-primary transition-colors"
                >
                  Return %
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedMetrics.map((metric, index) => {
              const isPositiveChange = metric.annualIncrease >= 0;
              const isPositiveReturn = metric.annualReturn >= 0;

              return (
                <tr
                  key={metric.year}
                  className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                >
                  <td className="px-3 py-2 font-medium">{metric.year}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(metric.endingNetWorth, currency)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${
                    isPositiveChange ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositiveChange ? '+' : ''}
                    {formatCurrency(metric.annualIncrease, currency)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${
                    isPositiveReturn ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositiveReturn ? '+' : ''}
                    {metric.annualReturn.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
