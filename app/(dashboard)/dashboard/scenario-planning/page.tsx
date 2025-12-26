import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { ScenarioPlanningClient } from "@/components/dashboard/scenario-planning/scenario-planning-client";

import { fetchOrCreateDefaultScenario } from "@/server/financial-scenarios/fetch";
import { fetchProfile } from "@/server/profile/actions";

async function ScenarioPlanningContent() {
  "use cache: private";
  const [scenario, { profile }] = await Promise.all([
    fetchOrCreateDefaultScenario(),
    fetchProfile(),
  ]);

  return (
    <ScenarioPlanningClient
      scenario={scenario}
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
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ScenarioPlanningContent />
      </Suspense>
    </div>
  );
}
