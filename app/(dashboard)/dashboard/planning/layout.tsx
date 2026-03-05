import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { PlanningStartingValue } from "@/components/dashboard/planning/settings/starting-value";
import { PlanningAssumptions } from "@/components/dashboard/planning/settings/assumptions";

import { fetchProfile } from "@/server/profile/actions";
import {
  fetchOrCreateDefaultScenario,
  fetchScenarioStartingValueSuggestions,
} from "@/server/financial-scenarios/fetch";

async function PlanningStartingValueWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();
  const [scenario, startingValueSuggestions] = await Promise.all([
    fetchOrCreateDefaultScenario(),
    fetchScenarioStartingValueSuggestions(profile.display_currency),
  ]);

  return (
    <PlanningStartingValue
      scenarioId={scenario.id}
      initialValue={scenario.initialValue}
      initialValueBasis={scenario.initialValueBasis}
      currency={profile.display_currency}
      startingValueSuggestions={startingValueSuggestions}
    />
  );
}

async function PlanningAssumptionsWrapper() {
  "use cache: private";
  const scenario = await fetchOrCreateDefaultScenario();

  return (
    <PlanningAssumptions
      scenarioId={scenario.id}
      assumptions={scenario.assumptions}
    />
  );
}

export default function PlanningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Scenario Planning</h1>
        <p className="text-muted-foreground">
          Plan your financial future with our scenario planning tool
        </p>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <Suspense fallback={<Skeleton className="h-20" />}>
          <PlanningStartingValueWrapper />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-24" />}>
          <PlanningAssumptionsWrapper />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
