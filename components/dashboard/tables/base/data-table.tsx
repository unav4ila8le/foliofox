"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type ExpandedState,
  type TableMeta,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableFooter,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";

// Extend TableMeta to include locale
declare module "@tanstack/react-table" {
  interface TableMeta<TData> {
    locale?: string;
    onEdit?: (row: TData, index: number) => void;
    onDelete?: (index: number) => void;
  }
}

// Helper type to ensure data has an id field for row identification
type DataWithId = { id: string | number };

interface DataTableProps<TData extends DataWithId, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterValue?: string;
  filterColumnId?: string;
  onRowClick?: (row: TData) => void;
  onSelectedRowsChange?: (rows: TData[]) => void;
  enableGrouping?: boolean;
  groupBy?: string[];
  meta?: TableMeta<TData>;
  defaultSorting?: SortingState;
  footer?: React.ReactNode;
}

export function DataTable<TData extends DataWithId, TValue>({
  columns,
  data,
  filterValue = "",
  filterColumnId = "name",
  onRowClick,
  onSelectedRowsChange,
  enableGrouping = false,
  groupBy = [],
  meta,
  defaultSorting = [],
  footer,
}: DataTableProps<TData, TValue>) {
  const locale = useLocale();
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>(true);

  // Memoize column filters to prevent unnecessary re-renders
  const columnFilters = useMemo<ColumnFiltersState>(() => {
    if (!filterValue?.trim()) return [];
    return [{ id: filterColumnId, value: filterValue }];
  }, [filterValue, filterColumnId]);

  // Memoize row selection change handler to prevent infinite re-renders
  const handleRowSelectionChange = useCallback(
    (
      updaterOrValue:
        | RowSelectionState
        | ((old: RowSelectionState) => RowSelectionState),
    ) => {
      setRowSelection(updaterOrValue);
    },
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: () => {},
    getFilteredRowModel: getFilteredRowModel(),
    ...(enableGrouping && {
      getGroupedRowModel: getGroupedRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      onExpandedChange: setExpanded,
    }),
    onRowSelectionChange: handleRowSelectionChange,
    enableRowSelection: true,
    enableExpanding: enableGrouping,
    groupedColumnMode: enableGrouping ? "remove" : false,
    autoResetAll: false,
    autoResetExpanded: false,
    autoResetPageIndex: false,
    getRowId: (row) => String(row.id),
    meta: { ...meta, locale },
    state: {
      sorting,
      columnFilters,
      rowSelection,
      ...(enableGrouping && {
        grouping: groupBy,
        expanded,
      }),
    },
  });

  // Emit selected rows to parent - only when selection actually changes
  useEffect(() => {
    if (!onSelectedRowsChange) return;
    const selectedRows = table
      .getSelectedRowModel()
      .rows.map((row) => row.original);
    onSelectedRowsChange(selectedRows);
  }, [rowSelection, onSelectedRowsChange, table]);

  // Memoize row click handler to prevent unnecessary re-renders
  const handleRowClick = useCallback(
    (rowData: TData) => {
      onRowClick?.(rowData);
    },
    [onRowClick],
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    style={{
                      width: header.column.columnDef.size,
                      minWidth: header.column.columnDef.minSize,
                      maxWidth: header.column.columnDef.maxSize,
                    }}
                    className={cn(
                      "text-muted-foreground",
                      header.column.columnDef.meta?.headerClassName,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                // Default group row rendering - can be customized via column definitions
                const visibleCells = row.getVisibleCells();
                const selectCell = visibleCells[0];
                const nameCell = visibleCells[1];

                return (
                  <TableRow
                    key={row.id}
                    data-state={false}
                    className="bg-accent/50"
                  >
                    {/* Select cell */}
                    <TableCell
                      style={{
                        width: selectCell.column.columnDef.size,
                        minWidth: selectCell.column.columnDef.minSize,
                        maxWidth: selectCell.column.columnDef.maxSize,
                      }}
                      className={
                        selectCell.column.columnDef.meta?.cellClassName
                      }
                    >
                      {flexRender(
                        selectCell.column.columnDef.cell,
                        selectCell.getContext(),
                      )}
                    </TableCell>
                    {/* Name cell */}
                    <TableCell colSpan={visibleCells.length - 1}>
                      {flexRender(
                        nameCell.column.columnDef.cell,
                        nameCell.getContext(),
                      )}
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={
                    onRowClick ? () => handleRowClick(row.original) : undefined
                  }
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        width: cell.column.columnDef.size,
                        minWidth: cell.column.columnDef.minSize,
                        maxWidth: cell.column.columnDef.maxSize,
                      }}
                      className={cell.column.columnDef.meta?.cellClassName}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-16 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {footer && <TableFooter>{footer}</TableFooter>}
      </Table>
    </div>
  );
}
