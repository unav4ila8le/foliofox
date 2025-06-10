import { Suspense } from "react";
import { Archive } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { fetchSingleHolding } from "@/server/holdings/fetch-single";
import { fetchRecords } from "@/server/records/fetch";

// Only needed for dynamic routes
interface HoldingPageProps {
  params: Promise<{
    holding: string;
  }>;
}

// Separate components for data fetching with suspense
async function HoldingPageHeader({ holdingId }: { holdingId: string }) {
  const holding = await fetchSingleHolding(holdingId);

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{holding.name}</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{holding.asset_type}</Badge>
          {holding.is_archived && (
            <Badge variant="secondary">
              <Archive className="size-4" /> Archived
            </Badge>
          )}
        </div>
      </div>
      <p className="text-muted-foreground">
        {holding.description || "No description"}
      </p>
    </div>
  );
}

async function RecordsTableWrapper({ holdingId }: { holdingId: string }) {
  const records = await fetchRecords(holdingId);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Records History</h2>
      <div className="rounded-md border p-4">
        <p className="text-muted-foreground">Records table will go here</p>
        <p className="text-muted-foreground text-sm">
          Found {records.length} records
        </p>
      </div>
    </div>
  );
}

// Main page component
export default async function HoldingPage({ params }: HoldingPageProps) {
  const { holding: holdingId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<Skeleton className="h-24" />}>
        <HoldingPageHeader holdingId={holdingId} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <RecordsTableWrapper holdingId={holdingId} />
      </Suspense>
    </div>
  );
}
