import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";

import { PortfolioRecordsTable } from "@/components/dashboard/portfolio-records/table/portfolio-records-table";

import { fetchPortfolioRecords } from "@/server/portfolio-records/fetch";

import {
  parsePortfolioRecordTypes,
  type PortfolioRecordType,
} from "@/lib/portfolio-records/filters";
import { getSearchParam } from "@/lib/search-params";
import { parseUtcDateKey } from "@/lib/date/date-utils";

interface RecordsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

async function RecordsTableWrapper({
  page,
  q,
  recordTypes,
  startDate,
  endDate,
  sortBy,
  sortDirection,
}: {
  page: number;
  q?: string;
  recordTypes?: PortfolioRecordType[];
  startDate?: Date;
  endDate?: Date;
  sortBy?: "date" | "created_at";
  sortDirection?: "asc" | "desc";
}) {
  "use cache: private";

  const portfolioRecordsPage = await fetchPortfolioRecords({
    page,
    pageSize: 50,
    q,
    includePositionNameInSearch: true,
    recordTypes,
    startDate,
    endDate,
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
  const parsedStartDate = dateFromParam
    ? parseUtcDateKey(dateFromParam)
    : undefined;
  const parsedEndDate = dateToParam ? parseUtcDateKey(dateToParam) : undefined;
  const startDate =
    parsedStartDate && !Number.isNaN(parsedStartDate.getTime())
      ? parsedStartDate
      : undefined;
  const endDate =
    parsedEndDate && !Number.isNaN(parsedEndDate.getTime())
      ? parsedEndDate
      : undefined;
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
          recordTypes={recordTypes.length > 0 ? recordTypes : undefined}
          startDate={startDate}
          endDate={endDate}
          sortBy={sortBy}
          sortDirection={sortDirection}
        />
      </Suspense>
    </div>
  );
}
