import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { Separator } from "@/components/ui/separator";
import { AssetHeader } from "@/components/dashboard/positions/asset/header";
import { PortfolioRecordsTable } from "@/components/dashboard/portfolio-records/table/portfolio-records-table";
import { AssetNews } from "@/components/dashboard/positions/asset/news";
import { AssetProjectedIncome } from "@/components/dashboard/positions/asset/projected-income";

import { fetchSinglePosition } from "@/server/positions/fetch";
import { fetchPortfolioRecords } from "@/server/portfolio-records/fetch";
import { fetchSymbol } from "@/server/symbols/fetch";
import { fetchSymbolNews } from "@/server/news/fetch";
import {
  calculateSymbolProjectedIncome,
  type ProjectedIncomeResult,
} from "@/server/analysis/projected-income";

// Only needed for dynamic routes
interface AssetPageProps {
  params: Promise<{
    asset: string;
  }>;
}

// Skeleton shell for the whole page
function PageSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-4">
      <div className="col-span-6">
        <Skeleton className="h-24" />
      </div>
      <div className="col-span-6 space-y-4 lg:col-span-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
      <div className="col-span-6 lg:col-span-4">
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

async function AssetContent({
  positionId,
  page,
}: {
  positionId: string;
  page: number;
}) {
  const position = await fetchSinglePosition(positionId);

  // Batch remaining requests
  const [portfolioRecordsPage, symbol, newsResult] = await Promise.all([
    fetchPortfolioRecords({ positionId, page, pageSize: 50 }),
    position.symbol_id
      ? fetchSymbol(position.symbol_id)
      : Promise.resolve(null),
    position.symbol_id
      ? fetchSymbolNews(position.symbol_id)
      : Promise.resolve({ success: false, data: [] }),
  ]);

  const hasSymbol = Boolean(symbol);

  const projectedIncome = hasSymbol
    ? await calculateSymbolProjectedIncome(
        symbol!.id,
        position.current_quantity,
      )
    : { success: true, data: [], currency: position.currency };

  const dividendCurrency =
    (projectedIncome as ProjectedIncomeResult)?.currency || position.currency;

  const {
    records,
    total,
    page: currentPage,
    pageSize,
    pageCount,
    hasNextPage,
    hasPreviousPage,
  } = portfolioRecordsPage;

  return (
    <div className="grid grid-cols-6 gap-4">
      {/* Header */}
      <div className="col-span-6">
        <AssetHeader position={position} symbol={symbol} />
      </div>

      <Separator className="col-span-6" />

      {hasSymbol && (
        <div className="col-span-6 space-y-4 lg:col-span-2">
          {/* News */}
          <div className="space-y-2">
            <h3 className="font-semibold">News</h3>
            <AssetNews newsData={newsResult} />
          </div>
          <Separator />
          {/* Projected Income */}
          <div className="space-y-3">
            <h3 className="font-semibold">Projected Income</h3>
            <AssetProjectedIncome
              projectedIncome={projectedIncome}
              dividendCurrency={dividendCurrency}
            />
          </div>
        </div>
      )}

      <Separator className="col-span-6 lg:hidden" />

      {/* Portfolio Records */}
      <div
        className={`col-span-6 space-y-2 ${hasSymbol ? "lg:col-span-4" : "lg:col-span-6"}`}
      >
        <h3 className="font-semibold">Records history</h3>
        <PortfolioRecordsTable
          data={records}
          position={position}
          pagination={{
            page: currentPage,
            pageSize,
            pageCount,
            total,
            hasNextPage,
            hasPreviousPage,
            baseHref: `/dashboard/assets/${positionId}`,
          }}
        />
      </div>
    </div>
  );
}

// Main page component
export default async function AssetPage({
  params,
  searchParams,
}: AssetPageProps & {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { asset: positionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const pageParam = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams.page[0]
    : resolvedSearchParams?.page;

  const parsedPage = Number(pageParam);
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <AssetContent positionId={positionId} page={page} />
    </Suspense>
  );
}
