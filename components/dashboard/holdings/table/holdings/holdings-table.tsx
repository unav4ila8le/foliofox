"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Archive, Package, Trash2 } from "lucide-react";

import { SearchInput } from "@/components/ui/search-input";
import { BulkActionBar } from "@/components/dashboard/holdings/table/base/bulk-action-bar";
import { DeleteHoldingDialog } from "@/components/dashboard/holdings/table/row-actions/delete-dialog";
import { ArchiveHoldingDialog } from "@/components/dashboard/holdings/table/row-actions/archive-dialog";
import { DataTable } from "../base/data-table";
import { columns } from "./columns";

import type { HoldingWithProfitLoss } from "@/types/global.types";

// Union type for table rows - holdings and category headers
type TableRow =
  | HoldingWithProfitLoss
  | {
      id: string;
      type: "category-header";
      categoryName: string;
      categoryCode: string;
      holdingCount: number;
    };

// Type guard to check if row is a category header
function isCategoryHeader(
  row: TableRow,
): row is Extract<TableRow, { type: "category-header" }> {
  return "type" in row && row.type === "category-header";
}

interface HoldingsTableProps {
  data: HoldingWithProfitLoss[];
}

export function HoldingsTable({ data }: HoldingsTableProps) {
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<HoldingWithProfitLoss[]>([]);
  const [resetSelectionSignal, setResetSelectionSignal] = useState(0);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openArchiveDialog, setOpenArchiveDialog] = useState(false);

  const router = useRouter();

  // Handle row click to navigate to holding page (only for holding rows)
  const handleRowClick = useCallback(
    (row: TableRow) => {
      if (!isCategoryHeader(row)) {
        router.push(`/dashboard/holdings/${row.id}`);
      }
    },
    [router],
  );

  // Transform data to include category headers
  const tableData = useMemo(() => {
    // Group holdings by category
    const groupedHoldings = data.reduce(
      (grouped, holding) => {
        const { category_code, asset_categories } = holding;
        if (!grouped[category_code]) {
          grouped[category_code] = {
            name: asset_categories.name,
            holdings: [],
          };
        }
        grouped[category_code].holdings.push(holding);
        return grouped;
      },
      {} as Record<string, { name: string; holdings: HoldingWithProfitLoss[] }>,
    );

    // Flatten into table rows with category headers
    const tableRows: TableRow[] = [];

    Object.entries(groupedHoldings).forEach(
      ([categoryCode, { name, holdings }]) => {
        // Add category header row
        tableRows.push({
          id: `category-${categoryCode}`,
          type: "category-header",
          categoryName: name,
          categoryCode,
          holdingCount: holdings.length,
        });

        // Add holding rows
        tableRows.push(...holdings);
      },
    );

    return tableRows;
  }, [data]);

  // Handle selection change - filter out category headers
  const handleSelectedRowsChange = useCallback((rows: TableRow[]) => {
    const holdingRows = rows.filter(
      (row): row is HoldingWithProfitLoss => !isCategoryHeader(row),
    );
    setSelectedRows(holdingRows);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <SearchInput
        className="max-w-sm"
        placeholder="Search holdings..."
        value={filterValue}
        onChange={(e) => setFilterValue(e.target.value)}
      />

      {/* Table */}
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-accent rounded-lg p-2">
            <Package className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">No holdings found</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Start building your portfolio by adding your first holding
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <DataTable
            columns={columns}
            data={tableData}
            filterValue={filterValue}
            onRowClick={handleRowClick}
            onSelectedRowsChange={handleSelectedRowsChange}
            resetRowSelectionSignal={resetSelectionSignal}
          />
        </div>
      )}

      {/* Rows count */}
      <p className="text-muted-foreground text-end text-sm">
        {data.length} holding(s)
      </p>

      {/* Floating bulk action bar */}
      {selectedRows.length > 0 && (
        <BulkActionBar
          selectedCount={selectedRows.length}
          actions={[
            {
              label: "Archive selected",
              onClick: () => setOpenArchiveDialog(true),
              icon: <Archive className="size-4" />,
              variant: "outline",
            },
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
      <DeleteHoldingDialog
        open={openDeleteDialog}
        onOpenChangeAction={setOpenDeleteDialog}
        holdings={selectedRows.map(({ id, name }) => ({ id, name }))} // Minimal DTO
        onCompleted={() => {
          setResetSelectionSignal((prev) => prev + 1);
        }}
      />

      {/* Archive dialog */}
      <ArchiveHoldingDialog
        open={openArchiveDialog}
        onOpenChangeAction={setOpenArchiveDialog}
        holdings={selectedRows.map(({ id, name }) => ({ id, name }))} // Minimal DTO
        onCompleted={() => {
          setResetSelectionSignal((prev) => prev + 1);
        }}
      />
    </div>
  );
}
