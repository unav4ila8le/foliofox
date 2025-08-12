"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type ExpandedState,
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterValue?: string;
  filterColumnId?: string;
  onRowClick?: (row: TData) => void;
  onSelectedRowsChange?: (rows: TData[]) => void;
  groupBy?: string[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterValue = "",
  filterColumnId = "name",
  onRowClick,
  onSelectedRowsChange,
  groupBy = [],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
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

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: () => {},
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
    onRowSelectionChange: handleRowSelectionChange,
    enableRowSelection: true,
    enableExpanding: true,
    groupedColumnMode: "remove",
    autoResetAll: false,
    autoResetExpanded: false,
    autoResetPageIndex: false,
    getRowId: (row, index) =>
      // @ts-expect-error - generic rows may or may not have id; fallback to index
      row?.id ? String(row.id) : String(index),
    state: {
      sorting,
      columnFilters,
      rowSelection,
      grouping: groupBy,
      expanded,
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
              // Render only the first visible cell (the Name column) and span the row
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
                    className={selectCell.column.columnDef.meta?.cellClassName}
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
                onClick={() => {
                  handleRowClick(row.original);
                }}
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
    </Table>
  );
}
