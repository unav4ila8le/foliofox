"use client";

import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";

import { SearchInput } from "@/components/ui/search-input";
import { DataTable } from "@/components/dashboard/holdings/table/base/data-table";
import { columns } from "@/components/dashboard/holdings/table/records/columns";
import { NewRecordButton } from "@/components/dashboard/new-record";
import { BulkActionBar } from "@/components/dashboard/holdings/table/base/bulk-action-bar";
import { DeleteRecordDialog } from "@/components/dashboard/holdings/table/records/row-actions/delete-dialog";

import type {
  TransformedRecord,
  TransformedHolding,
} from "@/types/global.types";

interface RecordsTableProps {
  data: TransformedRecord[];
  holding: TransformedHolding;
}

export function RecordsTable({ data, holding }: RecordsTableProps) {
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<TransformedRecord[]>([]);
  const [resetSelectionSignal, setResetSelectionSignal] = useState(0);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        {/* Search */}
        <SearchInput
          className="max-w-sm"
          placeholder="Search records..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        {/* New record button */}
        {data.length > 0 && (
          <NewRecordButton variant="outline" preselectedHolding={holding} />
        )}
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-accent rounded-lg p-2">
            <FileText className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">No records found</p>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Records for this holding will appear here
          </p>
          <NewRecordButton variant="outline" preselectedHolding={holding} />
        </div>
      ) : (
        <div className="rounded-md border">
          <DataTable
            columns={columns}
            data={data}
            filterValue={filterValue}
            filterColumnId="description"
            onSelectedRowsChange={setSelectedRows}
            resetRowSelectionSignal={resetSelectionSignal}
          />
        </div>
      )}

      {/* Rows count */}
      <p className="text-muted-foreground text-end text-sm">
        {data.length} record(s)
      </p>

      {/* Floating bulk action bar */}
      {selectedRows.length > 0 && (
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
      <DeleteRecordDialog
        open={openDeleteDialog}
        onOpenChangeAction={setOpenDeleteDialog}
        records={selectedRows}
        onCompleted={() => {
          setResetSelectionSignal((prev) => prev + 1);
        }}
      />
    </div>
  );
}
