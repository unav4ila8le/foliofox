import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { HoldingsTables } from "@/components/dashboard/assets/table/holdings/holdings-tables";

import { fetchHoldings } from "@/server/holdings/fetch";

// Separate components for data fetching with suspense
async function HoldingsTablesWrapper() {
  const holdings = await fetchHoldings();
  return <HoldingsTables data={holdings} />;
}

export default async function AssetsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Asset Portfolio</h1>
        <p className="text-muted-foreground">
          Here&apos;s a list of all your holdings
        </p>
      </div>
      <Suspense fallback={<Skeleton count={4} className="h-40" />}>
        <HoldingsTablesWrapper />
      </Suspense>
    </div>
  );
}
