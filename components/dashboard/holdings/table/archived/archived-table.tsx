"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { DeleteHoldingDialog } from "@/components/dashboard/holdings/table/row-actions/delete-dialog";
import { DataTable } from "../base/data-table";
import { columns } from "./columns";

import type { RowSelectionState } from "@tanstack/react-table";
import type { TransformedHolding } from "@/types/global.types";

interface ArchivedTableProps {
  data: TransformedHolding[];
}

export function ArchivedTable({ data }: ArchivedTableProps) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SearchInput
          className="max-w-sm"
          placeholder="Search archived holdings..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        {selectedRows.length > 0 && (
          <Button onClick={() => setOpenDelete(true)} variant="outline">
            <Trash2 className="text-destructive size-4" /> Delete
          </Button>
        )}
      </div>
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
      <p className="text-muted-foreground text-end text-sm">
        {data.length} archived holding(s)
      </p>

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
