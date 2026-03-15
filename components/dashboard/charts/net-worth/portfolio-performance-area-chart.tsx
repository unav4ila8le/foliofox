"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PerformanceHistoryPoint } from "@/server/analysis/performance/types";

import { formatPercentage } from "@/lib/number-format";
import { formatDate, formatMonthDay } from "@/lib/date/date-format";

interface PortfolioPerformanceAreaChartProps {
  history: PerformanceHistoryPoint[];
  locale: string;
  isPrivacyMode: boolean;
  strokeColor: string;
}

function formatSignedPercentage(value: number, locale: string) {
  const formatted = formatPercentage(value / 100, { locale });
  return value > 0 ? `+${formatted}` : formatted;
}

export function PortfolioPerformanceAreaChart({
  history,
  locale,
  isPrivacyMode,
  strokeColor,
}: PortfolioPerformanceAreaChartProps) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      initialDimension={{ width: 256, height: 128 }}
    >
      <AreaChart data={history}>
        <defs>
          <linearGradient
            id="portfolioPerformanceAreaGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <YAxis
          dataKey="cumulativeReturnPct"
          tickFormatter={(value: number) =>
            formatPercentage(value / 100, { locale, decimals: 0 })
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
          tickFormatter={(date: Date) =>
            formatMonthDay(date, {
              locale,
              month: "short",
              day: "numeric",
            })
          }
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
                  {formatSignedPercentage(Number(data.value), locale)}
                </span>
              </div>
            );
          }}
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
        />
        <Area
          dataKey="cumulativeReturnPct"
          stroke={strokeColor}
          strokeWidth={1.5}
          fill="url(#portfolioPerformanceAreaGradient)"
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
  );
}
