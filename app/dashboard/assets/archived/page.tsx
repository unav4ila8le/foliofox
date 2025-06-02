import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { HoldingsTables } from "@/components/dashboard/assets/holdings-tables";

import { fetchHoldings } from "@/server/holdings/fetch";

// Separate components for data fetching with suspense
async function HoldingsTablesWrapper() {
  const holdings = await fetchHoldings({ onlyArchived: true });
  return <HoldingsTables data={holdings} />;
}

export default async function ArchivedAssetsPage() {
  return (
    <Suspense fallback={<Skeleton count={4} className="h-40" />}>
      <HoldingsTablesWrapper />
    </Suspense>
  );
}
