# Simulation Feature Integration Steps

## Summary

The simulation feature is **90% complete**. Here's what's done and what remains:

### ✅ Complete
1. `lib/simulation.ts` - All types and utility functions
2. `lib/projection-aggregation.ts` - Time scale support
3. `components/dashboard/plans/simulation-sidebar.tsx` - Full sidebar UI

### 🔧 Remaining Work

The Plans page (`app/dashboard/plans/page.tsx`) needs to be updated to:
1. Use simulation-based state instead of individual states
2. Integrate the SimulationSidebar component
3. Pass multiple simulations to the chart
4. Update the chart component to render multiple lines

## Quick Integration (Copy-Paste Ready)

### Step 1: Add Simulation State to Plans Page

Add this after the imports in `page.tsx` (around line 105):

```typescript
export default function PlansPage() {
  // Simulation-based state (replaces all individual states)
  const [simulations, setSimulations] = useLocalStorage<any[]>("plans_simulations_v2", []);
  const [activeSimulationId, setActiveSimulationId] = useLocalStorage<string | null>("plans_activeSimId", null);

  // Deserialize simulations (handle Date objects)
  const deserializedSimulations: Simulation[] = useMemo(() =>
    simulations.map(s => ({
      ...s,
      createdAt: new Date(s.createdAt),
      lastModified: new Date(s.lastModified),
      data: {
        ...s.data,
        startDate: new Date(s.data.startDate),
        oneTimeEvents: s.data.oneTimeEvents.map((e: any) => ({
          ...e,
          date: new Date(e.date),
        })),
        recurringEvents: s.data.recurringEvents.map((e: any) => ({
          ...e,
          startDate: new Date(e.startDate),
          endDate: e.endDate ? new Date(e.endDate) : undefined,
        })),
      },
    })),
    [simulations]
  );

  // Initialize with default simulation if empty
  useEffect(() => {
    if (deserializedSimulations.length === 0) {
      const defaultSim = createSimulation("Current Reality", {
        startDate: new Date(),
        timeHorizon: 10,
        timeScale: 'monthly',
        oneTimeEvents: [],
        recurringEvents: [],
        categoryAssumptions: DEMO_CATEGORIES.length > 0 ? DEMO_CATEGORIES : [{
          categoryId: "cash",
          categoryName: "Cash",
          currentValue: 10000,
          expectedAnnualReturn: 0.015,
          variance: 0,
        }],
        reinvestmentAllocation: [{ categoryId: "cash", percentage: 1.0 }],
        annualExpenses: 60000,
        reinvestmentRate: 0.5,
      });
      setSimulations([defaultSim]);
      setActiveSimulationId(defaultSim.id);
    } else if (!activeSimulationId) {
      setActiveSimulationId(deserializedSimulations[0].id);
    }
  }, [deserializedSimulations.length, activeSimulationId]);

  // Get active simulation
  const activeSimulation = deserializedSimulations.find(s => s.id === activeSimulationId);
  if (!activeSimulation) return <div>Loading...</div>;

  // Helper: Update active simulation's data
  const updateActiveSimulationData = (updates: Partial<SimulationData>) => {
    setSimulations(
      updateSimulation(deserializedSimulations, activeSimulation.id, {
        data: { ...activeSimulation.data, ...updates }
      })
    );
  };

  // Simulation CRUD handlers
  const handleCreateNew = () => {
    const newSim = createSimulation(
      `Simulation ${deserializedSimulations.length + 1}`,
      { ...activeSimulation.data }, // Clone current data
      deserializedSimulations
    );
    setSimulations([...deserializedSimulations, newSim]);
    setActiveSimulationId(newSim.id);
  };

  const handleClone = (id: string) => {
    const original = deserializedSimulations.find(s => s.id === id);
    if (!original) return;

    const cloned = cloneSimulation(
      original,
      `${original.name} (Copy)`,
      deserializedSimulations
    );
    setSimulations([...deserializedSimulations, cloned]);
  };

  const handleDelete = (id: string) => {
    const updated = deleteSimulation(deserializedSimulations, id);
    setSimulations(updated);
    if (activeSimulationId === id && updated.length > 0) {
      setActiveSimulationId(updated[0].id);
    }
  };

  const handleRename = (id: string, newName: string) => {
    setSimulations(
      updateSimulation(deserializedSimulations, id, { name: newName })
    );
  };

  // Convenience accessors (so existing code still works)
  const events = activeSimulation.data.oneTimeEvents;
  const recurringEvents = activeSimulation.data.recurringEvents;
  const categoryAssumptions = activeSimulation.data.categoryAssumptions;
  const reinvestmentAllocation = activeSimulation.data.reinvestmentAllocation;
  const annualExpenses = activeSimulation.data.annualExpenses;
  const reinvestmentRate = activeSimulation.data.reinvestmentRate;
  const timeScale = activeSimulation.data.timeScale;
  const timeHorizon = activeSimulation.data.timeHorizon.toString();
  const startDate = format(activeSimulation.data.startDate, "yyyy-MM-dd");

  // Update handlers (modify to use updateActiveSimulationData)
  const setEvents = (newEvents: OneTimeEvent[]) => {
    updateActiveSimulationData({ oneTimeEvents: newEvents });
  };

  const setRecurringEvents = (newEvents: RecurringEvent[]) => {
    updateActiveSimulationData({ recurringEvents: newEvents });
  };

  const setCategoryAssumptions = (cats: CategoryAssumption[]) => {
    updateActiveSimulationData({ categoryAssumptions: cats });
  };

  const setReinvestmentAllocation = (alloc: any[]) => {
    updateActiveSimulationData({ reinvestmentAllocation: alloc });
  };

  const setAnnualExpenses = (val: number) => {
    updateActiveSimulationData({ annualExpenses: val });
  };

  const setReinvestmentRate = (val: number) => {
    updateActiveSimulationData({ reinvestmentRate: val });
  };

  const setTimeScale = (val: TimeScale) => {
    updateActiveSimulationData({ timeScale: val });
  };

  const setTimeHorizon = (val: string) => {
    updateActiveSimulationData({ timeHorizon: Number(val) });
  };

  const setStartDate = (val: string) => {
    updateActiveSimulationData({ startDate: new Date(val) });
  };

  // ... rest of your existing handlers and component code ...
```

### Step 2: Update Page Layout

Wrap the existing content with sidebar:

```typescript
return (
  <div className="flex h-screen overflow-hidden">
    {/* Simulation Sidebar */}
    <SimulationSidebar
      simulations={deserializedSimulations}
      activeSimulationId={activeSimulationId}
      onSelectSimulation={setActiveSimulationId}
      onToggleVisibility={(id) => setSimulations(toggleSimulationVisibility(deserializedSimulations, id))}
      onSetPrimary={(id) => setSimulations(setPrimarySimulation(deserializedSimulations, id))}
      onCreateNew={handleCreateNew}
      onClone={handleClone}
      onDelete={handleDelete}
      onRename={handleRename}
    />

    {/* Main Content (existing code) */}
    <div className="flex-1 overflow-auto">
      <div className="container mx-auto space-y-6 py-8">
        {/* All your existing content here */}
        {/* ... chart, forms, etc ... */}
      </div>
    </div>
  </div>
);
```

### Step 3: Update Chart Component to Support Multiple Simulations

The chart needs to receive all visible simulations and render multiple lines.

For now, you can keep using single projection by passing only the active simulation, or enhance it to show multiple.

**Simple approach (show active only):**
```typescript
<PlanProjectionChart
  projection={projection}
  // ... other props stay the same
/>
```

**Advanced approach (show all visible):**
This requires more chart refactoring. I recommend starting with the simple approach and enhancing later.

## Testing the Integration

1. **Start fresh**: Clear localStorage key `plans_simulations_v2`
2. **Load page**: Should create default "Current Reality" simulation
3. **Add events**: Should save to active simulation
4. **Create new simulation**: Click "+ New Simulation" in sidebar
5. **Switch simulations**: Click different simulations, forms should load their data
6. **Clone**: Click "Clone" on a simulation
7. **Visibility**: Toggle checkboxes, chart should update
8. **Primary**: Click stars, one should be filled

## Next Session Enhancements

Once basic simulation management works:

1. **Multi-line chart**: Show all visible simulations on one chart
2. **Enhanced tooltip**: Show all simulation values at hovered point
3. **Color picker**: Let users choose simulation colors
4. **Export/import**: Save simulations to file
5. **Keyboard shortcuts**: Ctrl+N for new, etc.

## Files Modified

1. ✅ `lib/simulation.ts` - Created
2. ✅ `components/dashboard/plans/simulation-sidebar.tsx` - Created
3. 🔧 `app/dashboard/plans/page.tsx` - Needs state refactoring (see above)
4. 🔧 `components/dashboard/plans/plan-projection-chart.tsx` - Future: multi-line support

## Current Status

**Foundation complete** ✅
**Sidebar UI complete** ✅
**Integration steps documented** ✅
**Ready for final integration** 🔧

Copy the code from Step 1 and Step 2 above into your Plans page to complete the integration!
