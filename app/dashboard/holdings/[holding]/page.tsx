import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { HoldingHeader } from "@/components/dashboard/holdings/holding/header";
import { RecordsTable } from "@/components/dashboard/holdings/tables/records/records-table";
import { HoldingNews } from "@/components/dashboard/holdings/holding/news";

import { fetchSingleHolding } from "@/server/holdings/fetch";
import { fetchRecords } from "@/server/records/fetch";
import { fetchSymbol } from "@/server/symbols/fetch";
import { fetchSymbolNews } from "@/server/news/fetch";

// Only needed for dynamic routes
interface HoldingPageProps {
  params: Promise<{
    holding: string;
  }>;
}

// Skeleton shell for the whole page
function PageSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-4">
      <div className="col-span-6">
        <Skeleton className="h-24" />
      </div>
      <div className="col-span-6 lg:col-span-2">
        <Skeleton className="h-80" />
      </div>
      <div className="col-span-6 lg:col-span-4">
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

async function HoldingContent({ holdingId }: { holdingId: string }) {
  const holding = await fetchSingleHolding(holdingId);

  // Batch all remaining requests
  const [records, symbol, newsResult] = await Promise.all([
    fetchRecords(holdingId),
    // Fetch symbol and news if symbol exists
    holding.symbol_id ? fetchSymbol(holding.symbol_id) : null,
    holding.symbol_id
      ? fetchSymbolNews(holding.symbol_id, 5)
      : { success: false, data: [] },
  ]);

  const hasSymbol = Boolean(symbol);

  return (
    <div className="grid grid-cols-6 gap-4">
      {/* Header */}
      <div className="col-span-6">
        <HoldingHeader holding={holding} symbol={symbol} />
      </div>

      {/* News */}
      {hasSymbol && (
        <div className="col-span-6 space-y-2 lg:col-span-2">
          <h3 className="font-semibold">News</h3>
          <HoldingNews newsData={newsResult} />
        </div>
      )}

      {/* Records */}
      <div
        className={`col-span-6 space-y-2 ${hasSymbol ? "lg:col-span-4" : "lg:col-span-6"}`}
      >
        <h3 className="font-semibold">Records history</h3>
        <RecordsTable data={records} holding={holding} />
      </div>
    </div>
  );
}

// Main page component
export default async function HoldingPage({ params }: HoldingPageProps) {
  const { holding: holdingId } = await params;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <HoldingContent holdingId={holdingId} />
    </Suspense>
  );
}
