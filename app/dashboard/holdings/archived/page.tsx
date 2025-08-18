import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ArchivedTable } from "@/components/dashboard/holdings/tables/archived/archived-table";

import { fetchHoldings } from "@/server/holdings/fetch";

// Separate components for data fetching with suspense
async function ArchivedTableWrapper() {
  const holdings = await fetchHoldings({ onlyArchived: true });
  return <ArchivedTable data={holdings} />;
}

export default async function ArchivedHoldingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <ArchivedTableWrapper />
    </Suspense>
  );
}
