"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ArchiveRestore, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { BulkActionBar } from "@/components/dashboard/holdings/table/base/bulk-action-bar";
import { DeleteHoldingDialog } from "@/components/dashboard/holdings/table/row-actions/delete-dialog";
import { DataTable } from "../base/data-table";
import { columns } from "./columns";

import { restoreHoldings } from "@/server/holdings/restore";

import type { TransformedHolding } from "@/types/global.types";

interface ArchivedTableProps {
  data: TransformedHolding[];
}

export function ArchivedTable({ data }: ArchivedTableProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<TransformedHolding[]>([]);
  const [resetSelectionSignal, setResetSelectionSignal] = useState(0);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const router = useRouter();

  // Handle row click to navigate to holding page
  const handleRowClick = useCallback(
    (holding: TransformedHolding) => {
      router.push(`/dashboard/holdings/${holding.id}`);
    },
    [router],
  );

  // Restore holdings
  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const holdingIds = selectedRows.map((row) => row.id);
      const result = await restoreHoldings(holdingIds);
      if (!result.success) {
        throw new Error(result.message || "Failed to restore holding(s)");
      }
      toast.success(`${result.count} holding(s) restored successfully`);
      // Reset selection state
      setResetSelectionSignal((prev) => prev + 1);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to restore holding(s)",
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <SearchInput
          className="max-w-sm"
          placeholder="Search archived holdings..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        {/* Bulk actions */}
        {selectedRows.length > 0 && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setOpenDeleteDialog(true)} variant="outline">
              <Trash2 className="text-destructive size-4" /> Delete
            </Button>
            <Button
              onClick={handleRestore}
              variant="outline"
              disabled={isRestoring}
            >
              {isRestoring ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArchiveRestore className="size-4" />
              )}{" "}
              Restore
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={data}
          filterValue={filterValue}
          onRowClick={handleRowClick}
          onSelectedRowsChange={setSelectedRows}
          resetRowSelectionSignal={resetSelectionSignal}
        />
      </div>

      {/* Rows count */}
      <p className="text-muted-foreground text-end text-sm">
        {data.length} archived holding(s)
      </p>

      {/* Floating bulk action bar */}
      {selectedRows.length > 0 && (
        <BulkActionBar
          selectedCount={selectedRows.length}
          actions={[
            {
              label: "Restore selected",
              onClick: handleRestore,
              icon: <ArchiveRestore className="size-4" />,
              variant: "outline",
              disabled: isRestoring,
              loading: isRestoring,
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
    </div>
  );
}
