import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";

import { PortfolioRecordsTable } from "@/components/dashboard/portfolio-records/table/portfolio-records-table";

import { fetchPortfolioRecords } from "@/server/portfolio-records/fetch";

import { getSearchParam } from "@/lib/search-params";

interface RecordsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

async function RecordsTableWrapper({
  page,
  q,
  sortBy,
  sortDirection,
}: {
  page: number;
  q?: string;
  sortBy?: "date" | "created_at";
  sortDirection?: "asc" | "desc";
}) {
  "use cache: private";

  const portfolioRecordsPage = await fetchPortfolioRecords({
    page,
    pageSize: 50,
    q,
    includePositionNameInSearch: true,
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
    <PortfolioRecordsTable
      data={records}
      showPositionColumn
      pagination={{
        page: currentPage,
        pageSize,
        pageCount,
        total,
        hasNextPage,
        hasPreviousPage,
        baseHref: "/dashboard/portfolio-records",
      }}
      emptyStateDescription="Add a new record to start tracking your portfolio"
    />
  );
}

export default async function RecordsPage(props: RecordsPageProps) {
  const searchParams = await props.searchParams;

  const pageParam = getSearchParam(searchParams, "page");
  const queryParam = getSearchParam(searchParams, "q");
  const sortParam = getSearchParam(searchParams, "sort");
  const directionParam = getSearchParam(searchParams, "dir");

  const parsedPage = Number(pageParam);
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const q = typeof queryParam === "string" ? queryParam : undefined;
  const sortBy =
    sortParam === "date" || sortParam === "created_at" ? sortParam : undefined;
  const sortDirection =
    directionParam === "asc" || directionParam === "desc"
      ? directionParam
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio Records</h1>
        <p className="text-muted-foreground">
          Browse and search your full record history
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <RecordsTableWrapper
          page={page}
          q={q}
          sortBy={sortBy}
          sortDirection={sortDirection}
        />
      </Suspense>
    </div>
  );
}
