/**
 * Simulation Types and Utilities
 *
 * Simulations are complete snapshots of planning assumptions that can be
 * compared side-by-side on the chart.
 */

import type { CategoryAssumption, OneTimeEvent, RecurringEvent } from "./planning-engine";
import type { TimeScale } from "./projection-aggregation";

export interface Simulation {
  id: string;
  name: string;
  color: string; // hex color for chart line
  isPrimary: boolean; // baseline simulation for comparison
  visible: boolean; // shown on chart
  createdAt: Date;
  lastModified: Date;

  // Complete snapshot of all planning data
  data: SimulationData;
}

export interface SimulationData {
  // Time settings
  startDate: Date;
  timeHorizon: number; // years
  timeScale: TimeScale;

  // Events
  oneTimeEvents: OneTimeEvent[];
  recurringEvents: RecurringEvent[];

  // Portfolio
  categoryAssumptions: CategoryAssumption[];
  reinvestmentAllocation: Array<{
    categoryId: string;
    percentage: number;
  }>;

  // Baseline assumptions
  annualExpenses: number;
  reinvestmentRate: number;
}

// Color palette for simulations
export const SIMULATION_COLORS = [
  { name: 'Blue', value: '#3b82f6', textClass: 'text-blue-500' },
  { name: 'Green', value: '#10b981', textClass: 'text-green-500' },
  { name: 'Orange', value: '#f59e0b', textClass: 'text-orange-500' },
  { name: 'Purple', value: '#8b5cf6', textClass: 'text-purple-500' },
  { name: 'Red', value: '#ef4444', textClass: 'text-red-500' },
  { name: 'Teal', value: '#14b8a6', textClass: 'text-teal-500' },
  { name: 'Pink', value: '#ec4899', textClass: 'text-pink-500' },
  { name: 'Indigo', value: '#6366f1', textClass: 'text-indigo-500' },
  { name: 'Cyan', value: '#06b6d4', textClass: 'text-cyan-500' },
  { name: 'Amber', value: '#f59e0b', textClass: 'text-amber-500' },
];

/**
 * Get next available color for a new simulation
 */
export function getNextSimulationColor(existingSimulations: Simulation[]): string {
  const usedColors = new Set(existingSimulations.map(s => s.color));
  const availableColor = SIMULATION_COLORS.find(c => !usedColors.has(c.value));
  return availableColor?.value || SIMULATION_COLORS[0].value;
}

/**
 * Create a new simulation from current data
 */
export function createSimulation(
  name: string,
  data: SimulationData,
  existingSimulations: Simulation[] = []
): Simulation {
  const now = new Date();

  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    color: getNextSimulationColor(existingSimulations),
    isPrimary: existingSimulations.length === 0, // First simulation is primary
    visible: true,
    createdAt: now,
    lastModified: now,
    data,
  };
}

/**
 * Clone an existing simulation with a new name
 */
export function cloneSimulation(
  original: Simulation,
  newName: string,
  existingSimulations: Simulation[]
): Simulation {
  const now = new Date();

  return {
    ...original,
    id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: newName,
    color: getNextSimulationColor(existingSimulations),
    isPrimary: false, // Clones are never primary
    visible: false, // Start hidden
    createdAt: now,
    lastModified: now,
    // Deep clone data to avoid references
    data: JSON.parse(JSON.stringify(original.data)),
  };
}

/**
 * Set a simulation as primary (and unset others)
 */
export function setPrimarySimulation(
  simulations: Simulation[],
  simulationId: string
): Simulation[] {
  return simulations.map(sim => ({
    ...sim,
    isPrimary: sim.id === simulationId,
  }));
}

/**
 * Toggle simulation visibility
 */
export function toggleSimulationVisibility(
  simulations: Simulation[],
  simulationId: string
): Simulation[] {
  return simulations.map(sim =>
    sim.id === simulationId
      ? { ...sim, visible: !sim.visible }
      : sim
  );
}

/**
 * Update simulation data
 */
export function updateSimulation(
  simulations: Simulation[],
  simulationId: string,
  updates: Partial<Simulation>
): Simulation[] {
  return simulations.map(sim =>
    sim.id === simulationId
      ? { ...sim, ...updates, lastModified: new Date() }
      : sim
  );
}

/**
 * Delete a simulation
 */
export function deleteSimulation(
  simulations: Simulation[],
  simulationId: string
): Simulation[] {
  const filtered = simulations.filter(sim => sim.id !== simulationId);

  // If we deleted the primary, make the first one primary
  if (filtered.length > 0 && !filtered.some(s => s.isPrimary)) {
    filtered[0].isPrimary = true;
  }

  return filtered;
}
