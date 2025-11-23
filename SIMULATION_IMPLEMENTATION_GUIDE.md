# Multi-Simulation Implementation Guide

## Overview
This guide outlines how to integrate the simulation feature into the Plans page.

## Key Changes Required

### 1. State Management (app/dashboard/plans/page.tsx)

Replace individual state variables with simulation-based state:

```typescript
// OLD approach (current):
const [annualExpenses, setAnnualExpenses] = useLocalStorage(...);
const [events, setEvents] = useState(...);
const [categoryAssumptions, setCategoryAssumptions] = useState(...);
// ... many individual states

// NEW approach (simulation-based):
const [simulations, setSimulations] = useLocalStorage<Simulation[]>("plans_simulations", []);
const [activeSimulationId, setActiveSimulationId] = useLocalStorage<string | null>("plans_activeSimId", null);

// Get active simulation
const activeSimulation = simulations.find(s => s.id === activeSimulationId) || simulations[0];

// Initialize with default simulation if empty
useEffect(() => {
  if (simulations.length === 0) {
    const defaultSim = createSimulation("Current Reality", {
      startDate: new Date(),
      timeHorizon: 10,
      timeScale: 'monthly',
      oneTimeEvents: [],
      recurringEvents: [],
      categoryAssumptions: DEMO_CATEGORIES,
      reinvestmentAllocation: [{ categoryId: "cash", percentage: 1.0 }],
      annualExpenses: 60000,
      reinvestmentRate: 0.5,
    });
    setSimulations([defaultSim]);
    setActiveSimulationId(defaultSim.id);
  }
}, []);
```

### 2. Update Handlers

All update handlers now update the active simulation:

```typescript
// Example: Update events
const updateActiveSimulationData = (updates: Partial<SimulationData>) => {
  if (!activeSimulation) return;

  setSimulations(
    updateSimulation(simulations, activeSimulation.id, {
      data: { ...activeSimulation.data, ...updates }
    })
  );
};

const addOneTimeEvent = () => {
  if (!newEventDescription || newEventAmount === 0) return;

  const newEvent: OneTimeEvent = {
    id: Date.now().toString(),
    date: new Date(newEventDate),
    amount: newEventAmount,
    description: newEventDescription,
    emoji: newEventEmoji || undefined,
  };

  updateActiveSimulationData({
    oneTimeEvents: [...activeSimulation.data.oneTimeEvents, newEvent]
  });

  // Reset form...
};
```

### 3. Sidebar Component

Create `components/dashboard/plans/simulation-sidebar.tsx`:

```typescript
interface SimulationSidebarProps {
  simulations: Simulation[];
  activeSimulationId: string | null;
  onSelectSimulation: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onCreateNew: () => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export function SimulationSidebar({
  simulations,
  activeSimulationId,
  onSelectSimulation,
  onToggleVisibility,
  onSetPrimary,
  onCreateNew,
  onClone,
  onDelete,
  onRename,
}: SimulationSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`transition-all ${isCollapsed ? 'w-12' : 'w-64'} border-r bg-muted/30`}>
      {/* Collapse/expand button */}
      <Button onClick={() => setIsCollapsed(!isCollapsed)}>
        {isCollapsed ? '→' : '←'}
      </Button>

      {!isCollapsed && (
        <>
          {/* Header */}
          <div className="p-4 border-b">
            <h3 className="font-semibold">📊 Simulations</h3>
            <Button onClick={onCreateNew} className="w-full mt-2">
              <Plus className="mr-2 h-4 w-4" />
              New Simulation
            </Button>
          </div>

          {/* Simulation list */}
          <div className="p-2 space-y-1">
            {simulations.map(sim => (
              <div
                key={sim.id}
                className={`p-2 rounded-md cursor-pointer ${
                  activeSimulationId === sim.id ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
                }`}
                onClick={() => onSelectSimulation(sim.id)}
              >
                <div className="flex items-center gap-2">
                  {/* Visibility toggle */}
                  <input
                    type="checkbox"
                    checked={sim.visible}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(sim.id);
                    }}
                  />

                  {/* Color indicator */}
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: sim.color }}
                  />

                  {/* Name */}
                  <span className="flex-1 text-sm font-medium">{sim.name}</span>

                  {/* Primary star */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetPrimary(sim.id);
                    }}
                  >
                    {sim.isPrimary ? '⭐' : '☆'}
                  </button>
                </div>

                {/* Action buttons (show on hover or active) */}
                {activeSimulationId === sim.id && (
                  <div className="flex gap-1 mt-2">
                    <Button size="sm" variant="ghost" onClick={() => onClone(sim.id)}>
                      Clone
                    </Button>
                    {simulations.length > 1 && (
                      <Button size="sm" variant="ghost" onClick={() => onDelete(sim.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

### 4. Multi-Line Chart

Update `plan-projection-chart.tsx` to accept multiple projections:

```typescript
interface PlanProjectionChartProps {
  // ... existing props
  simulations: Simulation[]; // NEW: All simulations to display
  visibleSimulationIds: string[]; // NEW: Which ones to show
}

export function PlanProjectionChart({
  simulations,
  visibleSimulationIds,
  currency,
  privacyMode,
  timeScale,
}: PlanProjectionChartProps) {
  // Calculate projections for all visible simulations
  const projections = useMemo(() => {
    return simulations
      .filter(sim => visibleSimulationIds.includes(sim.id))
      .map(sim => {
        const inputs: PlanInputs = {
          startDate: sim.data.startDate,
          timeHorizonYears: sim.data.timeHorizon,
          categoryAssumptions: sim.data.categoryAssumptions,
          incomeExpense: {
            annualIncome: { mean: 0, variance: 0 },
            annualExpenses: { mean: sim.data.annualExpenses, variance: 0 },
            reinvestmentRate: sim.data.reinvestmentRate,
            reinvestmentAllocation: sim.data.reinvestmentAllocation,
          },
          oneTimeEvents: sim.data.oneTimeEvents,
          recurringEvents: sim.data.recurringEvents,
          plannedSales: [],
        };

        return {
          simulation: sim,
          projection: projectNetWorth(inputs, 'expected'),
        };
      });
  }, [simulations, visibleSimulationIds]);

  // Combine all projection data for chart
  const chartData = useMemo(() => {
    // ... aggregate all projections into single chart data structure
    // Each point contains: { timestamp, sim1Value, sim2Value, sim3Value, ... }
  }, [projections]);

  return (
    <ResponsiveContainer>
      <AreaChart data={chartData}>
        {/* ... axes, grid, etc */}

        {/* Render one Area/Line per visible simulation */}
        {projections.map(({ simulation, projection }) => (
          <Area
            key={simulation.id}
            dataKey={`value_${simulation.id}`}
            stroke={simulation.color}
            fill={simulation.color}
            fillOpacity={simulation.isPrimary ? 0.2 : 0.1}
            strokeWidth={simulation.isPrimary ? 2.5 : 1.5}
            name={simulation.name}
          />
        ))}

        {/* Enhanced tooltip showing all simulations */}
        <Tooltip content={<MultiSimTooltip />} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### 5. Page Layout Update

Modify Plans page layout to include sidebar:

```typescript
return (
  <div className="flex h-screen">
    {/* Sidebar */}
    <SimulationSidebar
      simulations={simulations}
      activeSimulationId={activeSimulationId}
      onSelectSimulation={setActiveSimulationId}
      onToggleVisibility={(id) => setSimulations(toggleSimulationVisibility(simulations, id))}
      onSetPrimary={(id) => setSimulations(setPrimarySimulation(simulations, id))}
      onCreateNew={handleCreateNewSimulation}
      onClone={handleCloneSimulation}
      onDelete={handleDeleteSimulation}
      onRename={handleRenameSimulation}
    />

    {/* Main content area */}
    <div className="flex-1 overflow-auto">
      {/* Chart */}
      <PlanProjectionChart
        simulations={simulations}
        visibleSimulationIds={simulations.filter(s => s.visible).map(s => s.id)}
        timeScale={activeSimulation?.data.timeScale || 'monthly'}
        // ...
      />

      {/* Forms (edit active simulation) */}
      {/* ... existing forms that now update activeSimulation.data ... */}
    </div>
  </div>
);
```

## Implementation Order

1. ✅ Create `lib/simulation.ts` (DONE)
2. Create `SimulationSidebar` component
3. Update Plans page state to use simulations
4. Update all event/category handlers to modify active simulation
5. Update chart to render multiple simulations
6. Add CRUD operations (new, clone, delete)
7. Enhanced multi-simulation tooltip
8. Polish and testing

## Testing Scenarios

1. Create simulation → verify it appears in sidebar
2. Add events to simulation → verify they're saved to correct simulation
3. Switch between simulations → verify forms load correct data
4. Toggle visibility → verify chart shows/hides lines
5. Set primary → verify thicker line on chart
6. Clone simulation → verify independent copy
7. Delete simulation → verify can't delete last one
