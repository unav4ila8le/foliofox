import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { fetchSingleHolding } from "@/server/holdings/fetch-single";
import { fetchRecords } from "@/server/records/fetch";

// Only needed for dynamic routes
interface HoldingPageProps {
  params: Promise<{
    holding: string;
  }>;
}

// Separate components for data fetching with suspense
async function RecordsTableWrapper({ holdingId }: { holdingId: string }) {
  const records = await fetchRecords(holdingId);

  // TODO: Replace with actual RecordsTable component
  return (
    <div className="rounded-md border p-4">
      <p className="text-muted-foreground">Records table will go here</p>
      <p className="text-muted-foreground text-sm">
        Found {records.length} records
      </p>
    </div>
  );
}

export default async function HoldingPage({ params }: HoldingPageProps) {
  const { holding: holdingId } = await params;

  const holding = await fetchSingleHolding(holdingId);

  return (
    <div className="flex flex-col gap-6">
      {/* TODO: Replace with actual HoldingHeader component */}
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{holding.name}</h1>
        <p className="text-muted-foreground">
          {holding.description || "No description"}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Records History</h2>
        <Suspense fallback={<Skeleton className="h-60" />}>
          <RecordsTableWrapper holdingId={holdingId} />
        </Suspense>
      </div>
    </div>
  );
}
