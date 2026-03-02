import { Suspense } from "react";
import { redirect } from "next/navigation";

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
import { calculateSymbolProjectedIncomePanelData } from "@/server/analysis/projected-income/symbol";

import { calculateProfitLoss } from "@/lib/profit-loss";
import { formatPercentage, formatCurrency } from "@/lib/number-format";
import { getRequestLocale } from "@/lib/locale/resolve-locale";
import { parsePortfolioRecordTypes } from "@/lib/portfolio-records/filters";
import { getSearchParam } from "@/lib/search-params";
import {
  formatUTCDateKey,
  toCivilDateKey,
  toCivilDateKeyOrThrow,
} from "@/lib/date/date-utils";
import { cn } from "@/lib/utils";

import type {
  PositionSnapshot,
  TransformedPosition,
} from "@/types/global.types";

// Skeleton for the full page, shown instantly during navigation
function PageSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-x-8 gap-y-4">
      <div className="col-span-6">
        <Skeleton className="h-32" />
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

// Projected Income
async function ProjectedIncomeWrapper({
  symbolId,
  quantity,
  unitValue,
  currency,
}: {
  symbolId: string;
  quantity: number;
  unitValue: number;
  currency: string;
}) {
  "use cache: private";

  const locale = await getRequestLocale();

  const { projectedIncome, dividendYield } =
    await calculateSymbolProjectedIncomePanelData(
      symbolId,
      quantity,
      12,
      unitValue,
      currency,
    );

  const dividendCurrency = projectedIncome?.currency || currency;
  const totalAnnualIncome =
    projectedIncome?.data?.reduce((sum, month) => sum + month.income, 0) || 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-row justify-between gap-4">
        <div>
          <h3 className="-mt-1 font-semibold">Projected Income</h3>
          <p className="text-muted-foreground text-sm">
            Dividend Yield{" "}
            <span className="text-foreground font-medium">
              {dividendYield
                ? formatPercentage(dividendYield, { locale })
                : "N/A"}
            </span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-muted-foreground">Est. Annual</p>
          <p className="text-green-600">
            {totalAnnualIncome > 0
              ? formatCurrency(totalAnnualIncome, dividendCurrency, { locale })
              : "N/A"}
          </p>
        </div>
      </div>
      <AssetProjectedIncome
        projectedIncome={projectedIncome}
        dividendCurrency={dividendCurrency}
      />
    </div>
  );
}

// News
async function NewsWrapper({ symbolId }: { symbolId: string }) {
  "use cache: private";

  const newsResult = await fetchSymbolNews(symbolId);

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">News</h3>
      <AssetNews newsData={newsResult} />
    </div>
  );
}

// Portfolio Records
async function RecordsWrapper({
  positionId,
  position,
  searchParamsPromise,
}: {
  positionId: string;
  position: TransformedPosition;
  searchParamsPromise?: Promise<Record<string, string | string[] | undefined>>;
}) {
  "use cache: private";

  const searchParams = await searchParamsPromise;

  // Keep records filter parsing scoped to the records block so
  // header/sidebar rendering is independent from query param parsing.
  const pageParam = getSearchParam(searchParams, "page");
  const queryParam = getSearchParam(searchParams, "q");
  const typeParam = getSearchParam(searchParams, "type");
  const dateFromParam = getSearchParam(searchParams, "dateFrom");
  const dateToParam = getSearchParam(searchParams, "dateTo");
  const sortParam = getSearchParam(searchParams, "sort");
  const directionParam = getSearchParam(searchParams, "dir");

  const parsedPage = Number(pageParam);
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const q = typeof queryParam === "string" ? queryParam : undefined;
  const recordTypes = parsePortfolioRecordTypes(typeParam);
  const startDateKey = dateFromParam
    ? (toCivilDateKey(dateFromParam) ?? undefined)
    : undefined;
  const endDateKey = dateToParam
    ? (toCivilDateKey(dateToParam) ?? undefined)
    : undefined;
  const sortBy =
    sortParam === "date" || sortParam === "created_at" ? sortParam : undefined;
  const sortDirection =
    directionParam === "asc" || directionParam === "desc"
      ? directionParam
      : undefined;

  const portfolioRecordsPage = await fetchPortfolioRecords({
    positionId,
    page,
    pageSize: 50,
    q,
    recordTypes,
    startDateKey,
    endDateKey,
    sortBy,
    sortDirection,
  });

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
    <>
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
    </>
  );
}

// Layout resolver - fetches position + symbol (fast gating data),
// renders the header, then streams the remaining sections.
async function AssetLayout({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
  searchParamsPromise?: Promise<Record<string, string | string[] | undefined>>;
}) {
  "use cache: private";

  const { id: positionId } = await paramsPromise;

  // Fetch position - needed for header and to determine hasSymbol layout
  let position: TransformedPosition;
  let snapshots: PositionSnapshot[];

  try {
    const asOfDateKey = toCivilDateKeyOrThrow(formatUTCDateKey(new Date()));
    const result = await fetchSinglePosition(positionId, {
      includeArchived: true,
      includeSnapshots: true,
      asOfDateKey,
    });
    position = result.position;
    snapshots = result.snapshots;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Position not found")
    ) {
      redirect("/dashboard/assets");
    }
    throw error;
  }

  const snapshotsMap = new Map([[position.id, snapshots]]);
  const [positionWithProfitLoss] = calculateProfitLoss(
    [position],
    snapshotsMap,
  );

  // Fetch symbol - fast single row, needed for header + conditional layout
  const symbol = position.symbol_id
    ? await fetchSymbol(position.symbol_id)
    : null;

  const hasSymbol = Boolean(symbol);

  return (
    <div className="grid grid-cols-6 gap-x-8 gap-y-4">
      {/* Header - renders immediately, data already available */}
      <div className="col-span-full">
        <AssetHeader
          position={position}
          symbol={symbol}
          positionWithProfitLoss={positionWithProfitLoss}
        />
      </div>

      {/* Symbol sidebar - projected income + news */}
      {hasSymbol && (
        <div className="col-span-full space-y-4 @[64rem]/dashboard:col-span-2">
          <Suspense fallback={<Skeleton className="h-80" />}>
            <ProjectedIncomeWrapper
              symbolId={position.symbol_id!}
              quantity={position.current_quantity}
              unitValue={position.current_unit_value}
              currency={position.currency}
            />
          </Suspense>
          <Separator />
          <Suspense fallback={<Skeleton className="h-64" />}>
            <NewsWrapper symbolId={position.symbol_id!} />
          </Suspense>
        </div>
      )}

      <Separator className="col-span-6 lg:hidden" />

      {/* Portfolio records */}
      <div
        className={cn(
          "col-span-full space-y-2",
          hasSymbol && "@[64rem]/dashboard:col-span-4",
        )}
      >
        <Suspense fallback={<Skeleton className="h-96" />}>
          <RecordsWrapper
            positionId={positionId}
            position={position}
            searchParamsPromise={searchParamsPromise}
          />
        </Suspense>
      </div>
    </div>
  );
}

// Main page component - synchronous so the shell (PageSkeleton) renders instantly.
// Passes params/searchParams as promises to AssetLayout instead of awaiting them here.
export default function AssetPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AssetLayout
        paramsPromise={props.params}
        searchParamsPromise={props.searchParams}
      />
    </Suspense>
  );
}
