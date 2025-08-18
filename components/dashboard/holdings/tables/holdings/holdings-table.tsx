"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Archive, Package, Trash2 } from "lucide-react";

import { SearchInput } from "@/components/ui/search-input";
import { NewHoldingButton } from "@/components/dashboard/new-holding";
import { TableActionsDropdown } from "@/components/dashboard/holdings/tables/holdings/table-actions";
import { BulkActionBar } from "@/components/dashboard/holdings/tables/base/bulk-action-bar";
import { DeleteHoldingDialog } from "@/components/dashboard/holdings/tables/row-actions/delete-dialog";
import { ArchiveHoldingDialog } from "@/components/dashboard/holdings/tables/row-actions/archive-dialog";
import { DataTable } from "../base/data-table";
import { columns } from "./columns";

import type { HoldingWithProfitLoss } from "@/types/global.types";

interface HoldingsTableProps {
  data: HoldingWithProfitLoss[];
}

export function HoldingsTable({ data }: HoldingsTableProps) {
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<HoldingWithProfitLoss[]>([]);

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

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
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
            data={data}
            filterValue={filterValue}
            onRowClick={handleRowClick}
            onSelectedRowsChange={setSelectedRows}
            enableGrouping={true}
            groupBy={["category_code"]}
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
          setSelectedRows([]);
        }}
      />

      {/* Archive dialog */}
      <ArchiveHoldingDialog
        open={openArchiveDialog}
        onOpenChangeAction={setOpenArchiveDialog}
        holdings={selectedRows.map(({ id, name }) => ({ id, name }))} // Minimal DTO
        onCompleted={() => {
          setSelectedRows([]);
        }}
      />
    </div>
  );
}
