import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { HoldingsTable } from "@/components/dashboard/holdings/table/holdings/holdings-table";

import { fetchHoldings } from "@/server/holdings/fetch";
import { calculateProfitLoss } from "@/lib/profit-loss";

// Separate components for data fetching with suspense
async function HoldingsTableWrapper() {
  // Fetch all holdings with their complete record history
  const { holdings, records } = await fetchHoldings({ includeRecords: true });
  // Transform data to add P/L calculations (no additional queries)
  const holdingsWithProfitLoss = calculateProfitLoss(holdings, records);

  return <HoldingsTable data={holdingsWithProfitLoss} />;
}

export default async function HoldingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio Holdings</h1>
        <p className="text-muted-foreground">
          Here&apos;s a list of all your holdings
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <HoldingsTableWrapper />
      </Suspense>
    </div>
  );
}
