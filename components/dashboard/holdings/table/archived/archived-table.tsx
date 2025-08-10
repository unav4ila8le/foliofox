"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ArchiveRestore, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { DeleteHoldingDialog } from "@/components/dashboard/holdings/table/row-actions/delete-dialog";
import { DataTable } from "../base/data-table";
import { columns } from "./columns";

import { restoreHoldings } from "@/server/holdings/restore";

import type { RowSelectionState } from "@tanstack/react-table";
import type { TransformedHolding } from "@/types/global.types";

interface ArchivedTableProps {
  data: TransformedHolding[];
}

export function ArchivedTable({ data }: ArchivedTableProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [filterValue, setFilterValue] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedRows, setSelectedRows] = useState<TransformedHolding[]>([]);
  const [openDelete, setOpenDelete] = useState(false);

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
      const ids = selectedRows.map((row) => row.id);
      const result = await restoreHoldings(ids);
      if (result.success) {
        toast.success(`${result.count} holding(s) restored successfully`);
      } else {
        throw new Error(result.message || "Failed to restore holding(s)");
      }
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
            <Button onClick={() => setOpenDelete(true)} variant="outline">
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
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          onSelectedChange={setSelectedRows}
        />
      </div>

      {/* Selected rows count */}
      {selectedRows.length > 0 ? (
        <p className="text-muted-foreground text-end text-sm">
          {selectedRows.length} of {data.length} row(s) selected
        </p>
      ) : (
        <p className="text-muted-foreground text-end text-sm">
          {data.length} archived holding(s)
        </p>
      )}

      {/* Delete dialog */}
      <DeleteHoldingDialog
        open={openDelete}
        onOpenChangeAction={setOpenDelete}
        holdings={selectedRows}
        onCompleted={() => {
          setSelectedRows([]);
          setRowSelection({});
        }}
      />
    </div>
  );
}
