import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { ScenarioChart } from "@/components/dashboard/scenario-planning/charts/scenario-chart";
import { ScenarioStartingValue } from "@/components/dashboard/scenario-planning/scenario-starting-value";
import { ScenarioEventsTable } from "@/components/dashboard/scenario-planning/table/scenario-events-table";

import {
  fetchOrCreateDefaultScenario,
  fetchScenarioStartingValueSuggestions,
} from "@/server/financial-scenarios/fetch";
import { fetchProfile } from "@/server/profile/actions";

async function ScenarioStartingValueWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();
  const [scenario, startingValueSuggestions] = await Promise.all([
    fetchOrCreateDefaultScenario(),
    fetchScenarioStartingValueSuggestions(profile.display_currency),
  ]);

  return (
    <ScenarioStartingValue
      scenarioId={scenario.id}
      initialValue={scenario.initialValue}
      initialValueBasis={scenario.initialValueBasis}
      currency={profile.display_currency}
      startingValueSuggestions={startingValueSuggestions}
    />
  );
}

async function ScenarioChartWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();
  const scenario = await fetchOrCreateDefaultScenario();

  return (
    <ScenarioChart
      scenario={scenario}
      currency={profile.display_currency}
      initialValue={scenario.initialValue}
      expectedAnnualReturnPercent={
        scenario.assumptions.values.expectedAnnualReturnPercent
      }
    />
  );
}

async function ScenarioEventsTableWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();
  const scenario = await fetchOrCreateDefaultScenario();

  if (scenario.events.length === 0) {
    return null;
  }

  return (
    <ScenarioEventsTable
      scenarioId={scenario.id}
      events={scenario.events}
      currency={profile.display_currency}
    />
  );
}

export default function ScenarioPlanningPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Scenario Planning</h1>
        <p className="text-muted-foreground">
          Plan your financial future with our scenario planning tool
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-24" />}>
        <ScenarioStartingValueWrapper />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-112" />}>
        <ScenarioChartWrapper />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <ScenarioEventsTableWrapper />
      </Suspense>
    </div>
  );
}
