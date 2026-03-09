"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  // Optional extra rows rendered inside <tfoot>.
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
  // Keep keyboard/selection anchors in refs so we can manage shift-range
  // selection without forcing extra renders.
  const isShiftPressedRef = useRef(false);
  const lastToggledRowIdRef = useRef<string | null>(null);
  const previousSelectionRef = useRef<RowSelectionState>({});
  const isApplyingShiftRangeRef = useRef(false);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        isShiftPressedRef.current = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        isShiftPressedRef.current = false;
      }
    };

    const handleWindowBlur = () => {
      isShiftPressedRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

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

  useEffect(() => {
    // Prevent re-processing when this same effect applied the range itself.
    if (isApplyingShiftRangeRef.current) {
      isApplyingShiftRangeRef.current = false;
      previousSelectionRef.current = rowSelection;
      return;
    }

    const previousSelection = previousSelectionRef.current;
    const changedRowIds = Array.from(
      new Set([
        ...Object.keys(previousSelection),
        ...Object.keys(rowSelection),
      ]),
    ).filter(
      (rowId) =>
        Boolean(previousSelection[rowId]) !== Boolean(rowSelection[rowId]),
    );

    // Only single-row toggles should define range anchor behavior.
    if (changedRowIds.length !== 1) {
      previousSelectionRef.current = rowSelection;
      if (changedRowIds.length > 1) {
        lastToggledRowIdRef.current = null;
      }
      return;
    }

    const currentRowId = changedRowIds[0];
    const anchorRowId = lastToggledRowIdRef.current;
    const shouldApplyRange =
      isShiftPressedRef.current &&
      anchorRowId !== null &&
      anchorRowId !== currentRowId;

    if (shouldApplyRange) {
      // Range is based on current visible row order (sorted/filtered/page-scoped).
      // Group rows are excluded because they are not true data records.
      const visibleSelectableRowIds = table
        .getRowModel()
        .rows.filter((row) => !row.getIsGrouped() && row.getCanSelect())
        .map((row) => row.id);

      const anchorIndex = visibleSelectableRowIds.indexOf(anchorRowId);
      const currentIndex = visibleSelectableRowIds.indexOf(currentRowId);

      if (anchorIndex !== -1 && currentIndex !== -1) {
        const [startIndex, endIndex] =
          anchorIndex < currentIndex
            ? [anchorIndex, currentIndex]
            : [currentIndex, anchorIndex];

        const nextSelection: RowSelectionState = { ...rowSelection };
        const shouldSelectRange = Boolean(rowSelection[currentRowId]);

        for (let index = startIndex; index <= endIndex; index += 1) {
          const rowIdInRange = visibleSelectableRowIds[index];
          if (shouldSelectRange) {
            nextSelection[rowIdInRange] = true;
          } else {
            delete nextSelection[rowIdInRange];
          }
        }

        isApplyingShiftRangeRef.current = true;
        setRowSelection(nextSelection);
        previousSelectionRef.current = nextSelection;
        lastToggledRowIdRef.current = currentRowId;
        return;
      }
    }

    previousSelectionRef.current = rowSelection;
    lastToggledRowIdRef.current = currentRowId;
  }, [rowSelection, table]);

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
                    onRowClick
                      ? (e) => {
                          if (!e.currentTarget.contains(e.target as Node))
                            return;
                          handleRowClick(row.original);
                        }
                      : undefined
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
