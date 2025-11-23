"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { format } from "date-fns";

import type { ProjectionResult } from "@/lib/planning-engine";
import type { Simulation } from "@/lib/simulation";
import { formatCurrency, formatCompactNumber } from "@/lib/number-format";
import {
  aggregateProjection,
  formatPeriodLabel,
  type TimeScale,
} from "@/lib/projection-aggregation";

interface MultiSimulationChartProps {
  simulations: Array<{
    simulation: Simulation;
    projection: ProjectionResult;
  }>;
  currency: string;
  timeScale?: TimeScale;
}

export function MultiSimulationChart({
  simulations,
  currency,
  timeScale = 'monthly',
}: MultiSimulationChartProps) {
  // Combine all simulation data into a single chart dataset
  const chartData = useMemo(() => {
    if (simulations.length === 0) return [];

    // Aggregate each simulation's data
    const aggregatedSimulations = simulations.map(({ simulation, projection }) => ({
      simulation,
      aggregatedData: aggregateProjection(projection.points, timeScale),
    }));

    // Find all unique timestamps across all simulations
    const timestampSet = new Set<number>();
    aggregatedSimulations.forEach(({ aggregatedData }) => {
      aggregatedData.forEach(point => {
        timestampSet.add(point.date.getTime());
      });
    });

    // Sort timestamps
    const timestamps = Array.from(timestampSet).sort((a, b) => a - b);

    // Build chart data with a value for each simulation at each timestamp
    return timestamps.map(timestamp => {
      const dataPoint: any = {
        timestamp,
        date: new Date(timestamp),
      };

      // Add net worth value for each simulation
      aggregatedSimulations.forEach(({ simulation, aggregatedData }) => {
        const point = aggregatedData.find(p => p.date.getTime() === timestamp);
        dataPoint[`sim_${simulation.id}`] = point?.netWorth ?? null;
      });

      return dataPoint;
    });
  }, [simulations, timeScale]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const date = new Date(label);

    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="mb-2 font-semibold">{formatPeriodLabel(date, timeScale)}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            const sim = simulations.find(s => `sim_${s.simulation.id}` === entry.dataKey);
            if (!sim || entry.value == null) return null;

            return (
              <div key={index} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: sim.simulation.color }}
                  />
                  <span>{sim.simulation.name}</span>
                  {sim.simulation.isPrimary && <span className="text-xs">⭐</span>}
                </div>
                <span className="font-mono font-semibold">
                  {formatCurrency(entry.value, currency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <defs>
          {simulations.map(({ simulation }) => (
            <linearGradient
              key={simulation.id}
              id={`gradient-${simulation.id}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={simulation.color}
                stopOpacity={simulation.isPrimary ? 0.3 : 0.15}
              />
              <stop
                offset="95%"
                stopColor={simulation.color}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(ts) => formatPeriodLabel(new Date(ts), timeScale)}
          className="text-xs"
        />
        <YAxis
          tickFormatter={(value) => formatCompactNumber(value, currency)}
          className="text-xs"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          content={({ payload }) => (
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              {simulations.map(({ simulation }) => (
                <div key={simulation.id} className="flex items-center gap-2 text-sm">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: simulation.color }}
                  />
                  <span>{simulation.name}</span>
                  {simulation.isPrimary && <span className="text-xs">⭐</span>}
                </div>
              ))}
            </div>
          )}
        />

        {/* Render an Area for each simulation */}
        {simulations.map(({ simulation }) => (
          <Area
            key={simulation.id}
            type="monotone"
            dataKey={`sim_${simulation.id}`}
            stroke={simulation.color}
            strokeWidth={simulation.isPrimary ? 2.5 : 1.5}
            fill={`url(#gradient-${simulation.id})`}
            connectNulls
            name={simulation.name}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
