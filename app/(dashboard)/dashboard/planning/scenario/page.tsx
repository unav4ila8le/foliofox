import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { ScenarioChart } from "@/components/dashboard/planning/scenario/charts/scenario-chart";
import { ScenarioEventsTable } from "@/components/dashboard/planning/scenario/table/scenario-events-table";

import { fetchOrCreateDefaultScenario } from "@/server/financial-scenarios/fetch";
import { fetchProfile } from "@/server/profile/actions";

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
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-112" />}>
        <ScenarioChartWrapper />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <ScenarioEventsTableWrapper />
      </Suspense>
    </div>
  );
}
