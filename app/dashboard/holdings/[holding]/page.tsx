import { Suspense } from "react";
import { Archive } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EditHoldingButton } from "@/components/dashboard/holdings/edit-holding-button";
import { RecordsTable } from "@/components/dashboard/holdings/table/records/records-table";

import { fetchSingleHolding } from "@/server/holdings/fetch";
import { fetchRecords } from "@/server/records/fetch";
import { fetchSymbol } from "@/server/symbols/fetch";

// Only needed for dynamic routes
interface HoldingPageProps {
  params: Promise<{
    holding: string;
  }>;
}

// Separate components for data fetching with suspense
async function HoldingPageHeader({ holdingId }: { holdingId: string }) {
  const holding = await fetchSingleHolding(holdingId);
  // Get symbol details for the holding (if it's supported)
  const symbol = holding.symbol_id
    ? await fetchSymbol(holding.symbol_id)
    : null;

  return (
    <div className="space-y-2">
      {/* Holding name and type */}
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
        <EditHoldingButton holding={holding} />
      </div>

      {/* Symbol details */}
      {symbol && (
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <p>
            Ticker Symbol
            <span className="text-foreground ml-1 font-medium">
              {symbol.id}
            </span>
          </p>
          {symbol.exchange && (
            <p>
              Exchange
              <span className="text-foreground ml-1 font-medium">
                {symbol.exchange}
              </span>
            </p>
          )}
          {symbol.currency && (
            <p>
              Currency
              <span className="text-foreground ml-1 font-medium">
                {symbol.currency}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Holding description */}
      {holding.description && (
        <p className="text-muted-foreground">{holding.description}</p>
      )}
    </div>
  );
}

async function RecordsTableWrapper({ holdingId }: { holdingId: string }) {
  const [holding, records] = await Promise.all([
    fetchSingleHolding(holdingId),
    fetchRecords(holdingId),
  ]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold">Records history</h3>
      <RecordsTable data={records} holding={holding} />
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
