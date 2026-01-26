"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { FileText, Trash2, Search } from "lucide-react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import { getPortfolioRecordColumns } from "@/components/dashboard/portfolio-records/table/columns";
import { NewPortfolioRecordButton } from "@/components/dashboard/new-portfolio-record";
import { ImportPortfolioRecordsButton } from "@/components/dashboard/portfolio-records/import";
import { TableActionsDropdown } from "@/components/dashboard/portfolio-records/table/table-actions";
import { BulkActionBar } from "@/components/dashboard/tables/base/bulk-action-bar";
import { DeletePortfolioRecordDialog } from "@/components/dashboard/portfolio-records/table/row-actions/delete-dialog";

import { cn } from "@/lib/utils";

import type {
  PortfolioRecordWithPosition,
  TransformedPosition,
} from "@/types/global.types";

interface PortfolioRecordsTableProps {
  data: PortfolioRecordWithPosition[];
  position?: TransformedPosition;
  showPositionColumn?: boolean;
  readOnly?: boolean;
  enableSearch?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    baseHref?: string;
  };
  emptyStateDescription?: string;
}

type PaginationEntry = number | "ellipsis";

function buildPaginationEntries(
  page: number,
  pageCount: number,
): PaginationEntry[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const entries: PaginationEntry[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) {
    entries.push("ellipsis");
  }

  for (let current = start; current <= end; current += 1) {
    entries.push(current);
  }

  if (end < pageCount - 1) {
    entries.push("ellipsis");
  }

  entries.push(pageCount);

  return entries;
}

export function PortfolioRecordsTable({
  data,
  position,
  showPositionColumn = false,
  readOnly = false,
  enableSearch = true,
  pagination,
  emptyStateDescription,
}: PortfolioRecordsTableProps) {
  const [filterValue, setFilterValue] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tableKey = useMemo(() => {
    const idsKey = data.map(({ id }) => id).join("-");
    return pagination
      ? `portfolio-records-${pagination.page}-${idsKey}`
      : `portfolio-records-${idsKey}`;
  }, [data, pagination]);

  const [selectionState, setSelectionState] = useState<{
    key: string;
    rows: PortfolioRecordWithPosition[];
  }>(() => ({
    key: tableKey,
    rows: [],
  }));
  const selectedRows =
    selectionState.key === tableKey ? selectionState.rows : [];

  const handleSelectedRowsChange = useCallback(
    (rows: PortfolioRecordWithPosition[]) => {
      setSelectionState({ key: tableKey, rows });
    },
    [tableKey],
  );

  const paginationEntries = useMemo(
    () =>
      pagination
        ? buildPaginationEntries(pagination.page, pagination.pageCount)
        : [],
    [pagination],
  );

  const createPageHref = useCallback(
    (targetPage: number) => {
      if (!pagination) return "#";
      const params = new URLSearchParams(searchParams.toString());
      if (targetPage === 1) {
        params.delete("page");
      } else {
        params.set("page", String(targetPage));
      }
      const basePath = pagination.baseHref ?? pathname;
      const query = params.toString();
      return query ? `${basePath}?${query}` : basePath;
    },
    [pagination, pathname, searchParams],
  );

  const isServerSearchEnabled =
    Boolean(pagination) && enableSearch && !readOnly;
  const showSearch = enableSearch && !readOnly;

  const searchParamKey = "q";
  const searchParamValue = searchParams.get(searchParamKey) ?? "";

  const handleSearchSubmit = useCallback(
    (nextInput?: string) => {
      if (!isServerSearchEnabled) return;

      const nextValue = (nextInput ?? filterValue).trim();
      const params = new URLSearchParams(searchParams.toString());

      if (nextValue) {
        params.set(searchParamKey, nextValue);
      } else {
        params.delete(searchParamKey);
      }

      params.delete("page");

      const nextQuery = params.toString();
      if (nextQuery === searchParams.toString()) {
        return;
      }

      const basePath = pagination?.baseHref ?? pathname;
      startTransition(() => {
        router.push(nextQuery ? `${basePath}?${nextQuery}` : basePath);
      });
    },
    [
      filterValue,
      isServerSearchEnabled,
      pagination,
      pathname,
      router,
      searchParams,
    ],
  );

  const handlePageChange = useCallback(
    (targetPage: number) => {
      if (!pagination || targetPage === pagination.page) return;

      startTransition(() => {
        router.push(createPageHref(targetPage));
      });
    },
    [pagination, router, createPageHref],
  );

  const paginationSummary = useMemo(() => {
    if (!pagination) {
      return `${data.length} record(s)`;
    }
    if (pagination.total === 0) {
      return "0 record(s)";
    }
    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(pagination.total, start + pagination.pageSize - 1);
    return `Showing ${start}-${end} of ${pagination.total} record(s)`;
  }, [pagination, data.length]);

  const previousHref = pagination
    ? createPageHref(
        pagination.hasPreviousPage ? pagination.page - 1 : pagination.page,
      )
    : "#";
  const nextHref = pagination
    ? createPageHref(
        pagination.hasNextPage ? pagination.page + 1 : pagination.page,
      )
    : "#";

  const columns = getPortfolioRecordColumns({ showPositionColumn, readOnly });

  return (
    <div
      className={cn("space-y-4", isPending && "pointer-events-none opacity-50")}
    >
      {/* Toolbar */}
      {(showSearch || (!readOnly && data.length > 0)) && (
        <div className="flex items-center justify-between gap-2">
          {/* Search */}
          {showSearch && (
            <InputGroup
              className="max-w-sm"
              key={isServerSearchEnabled ? searchParamValue : "client"}
            >
              <InputGroupInput
                placeholder="Search records..."
                {...(isServerSearchEnabled
                  ? { defaultValue: searchParamValue }
                  : {
                      value: filterValue,
                      onChange: (event) => setFilterValue(event.target.value),
                    })}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (isServerSearchEnabled) {
                    handleSearchSubmit(event.currentTarget.value);
                    return;
                  }
                  handleSearchSubmit();
                }}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
          )}
          <div className="flex items-center gap-2">
            {/* New record button */}
            {!readOnly && data.length > 0 && (
              <>
                <NewPortfolioRecordButton
                  variant="outline"
                  preselectedPosition={position}
                />
                <TableActionsDropdown />
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-accent rounded-lg p-2">
            <FileText className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">No records found</p>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            {emptyStateDescription ||
              "Records for this position will appear here"}
          </p>
          <div className="flex items-center justify-center gap-2">
            <NewPortfolioRecordButton
              variant="outline"
              preselectedPosition={position}
            />
            <ImportPortfolioRecordsButton variant="outline" />
          </div>
        </div>
      ) : (
        <DataTable
          key={tableKey}
          columns={columns}
          data={data}
          filterValue={isServerSearchEnabled ? "" : filterValue}
          filterColumnId="description"
          onSelectedRowsChange={handleSelectedRowsChange}
        />
      )}

      {/* Pagination */}
      {!readOnly && pagination && pagination.pageCount > 1 && (
        <Pagination className="justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={previousHref}
                aria-disabled={!pagination.hasPreviousPage || isPending}
                tabIndex={
                  !pagination.hasPreviousPage || isPending ? -1 : undefined
                }
                className={
                  !pagination.hasPreviousPage || isPending
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                onClick={(event) => {
                  event.preventDefault();
                  if (!pagination.hasPreviousPage || isPending) return;
                  handlePageChange(pagination.page - 1);
                }}
              />
            </PaginationItem>
            {paginationEntries.map((entry, index) => (
              <PaginationItem key={`${entry}-${index}`}>
                {entry === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href={createPageHref(entry)}
                    isActive={entry === pagination.page}
                    aria-disabled={isPending}
                    tabIndex={
                      isPending || entry === pagination.page ? -1 : undefined
                    }
                    className={cn(
                      isPending && "pointer-events-none opacity-50",
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      if (isPending || entry === pagination.page) return;
                      handlePageChange(entry);
                    }}
                  >
                    {entry}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={nextHref}
                aria-disabled={!pagination.hasNextPage || isPending}
                tabIndex={!pagination.hasNextPage || isPending ? -1 : undefined}
                className={
                  !pagination.hasNextPage || isPending
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                onClick={(event) => {
                  event.preventDefault();
                  if (!pagination.hasNextPage || isPending) return;
                  handlePageChange(pagination.page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Rows count */}
      <p className="text-muted-foreground text-end text-sm">
        {paginationSummary}
      </p>

      {/* Floating bulk action bar */}
      {!readOnly && selectedRows.length > 0 && (
        <BulkActionBar
          selectedCount={selectedRows.length}
          actions={[
            {
              label: "Delete selected",
              onClick: () => setOpenDeleteDialog(true),
              icon: <Trash2 className="size-4" />,
              variant: "destructive",
            },
          ]}
        />
      )}

      {/* Delete dialog */}
      {!readOnly && (
        <DeletePortfolioRecordDialog
          open={openDeleteDialog}
          onOpenChangeAction={setOpenDeleteDialog}
          portfolioRecords={selectedRows.map(({ id }) => ({ id }))} // Minimal DTO
          onCompleted={() => {
            setSelectionState({ key: tableKey, rows: [] });
          }}
        />
      )}
    </div>
  );
}
