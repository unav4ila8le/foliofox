"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Package, Archive, Trash2 } from "lucide-react";

import { SearchInput } from "@/components/ui/search-input";
import { NewHoldingButton } from "@/components/dashboard/new-holding";
import { columns } from "@/components/dashboard/holdings/table/holdings/columns";
import { TableActionsDropdown } from "@/components/dashboard/holdings/table/holdings/table-actions";
import { BulkActionBar } from "@/components/dashboard/holdings/table/base/bulk-action-bar";
import { CollapsibleTable } from "../collapsible/collapsible-table";
import { DeleteHoldingDialog } from "../row-actions/delete-dialog";
import { ArchiveHoldingDialog } from "../row-actions/archive-dialog";

import type { HoldingWithProfitLoss } from "@/types/global.types";

type GroupedHoldings = {
  [key: string]: {
    name: string;
    holdings: HoldingWithProfitLoss[];
  };
};

export function HoldingsTables({ data }: { data: HoldingWithProfitLoss[] }) {
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<HoldingWithProfitLoss[]>([]);
  const [resetSelectionSignal, setResetSelectionSignal] = useState(0);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openArchiveDialog, setOpenArchiveDialog] = useState(false);

  const router = useRouter();

  // Handle row click to navigate to holding page
  const handleRowClick = useCallback(
    (holding: HoldingWithProfitLoss) => {
      router.push(`/dashboard/holdings/${holding.id}`);
    },
    [router],
  );

  // Group holdings by category without filtering (TanStack will handle filtering)
  const groupedHoldings = data.reduce((grouped, holding) => {
    const { category_code, asset_categories } = holding;
    if (!grouped[category_code]) {
      grouped[category_code] = {
        name: asset_categories.name,
        holdings: [],
      };
    }
    grouped[category_code].holdings.push(holding);
    return grouped;
  }, {} as GroupedHoldings);

  return (
    <div className="flex flex-col gap-4">
      {/* Page toolbar */}
      <div className="flex items-center justify-between gap-2">
        <SearchInput
          className="max-w-sm"
          placeholder="Search holdings..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        <NewHoldingButton variant="outline" />
        <TableActionsDropdown holdingsCount={data.length} />
      </div>

      {/* Tables */}
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
        Object.entries(groupedHoldings).map(
          ([categoryCode, { name, holdings }]) => (
            <CollapsibleTable
              key={categoryCode}
              columns={columns}
              data={holdings}
              title={name}
              filterValue={filterValue}
              onRowClick={handleRowClick}
              onSelectedRowsChange={setSelectedRows}
              resetRowSelectionSignal={resetSelectionSignal}
            />
          ),
        )
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
