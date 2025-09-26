"use client";

import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";

import { SearchInput } from "@/components/ui/search-input";
import { DataTable } from "@/components/dashboard/holdings/tables/base/data-table";
import { getTransactionColumns } from "@/components/dashboard/holdings/tables/transactions/columns";
import { NewRecordButton } from "@/components/dashboard/new-record";
import { BulkActionBar } from "@/components/dashboard/holdings/tables/base/bulk-action-bar";
import { DeleteTransactionDialog } from "@/components/dashboard/holdings/tables/transactions/row-actions/delete-dialog";

import type {
  TransactionWithHolding,
  TransformedHolding,
} from "@/types/global.types";

interface TransactionsTableProps {
  data: TransactionWithHolding[];
  holding?: TransformedHolding;
  showHoldingColumn?: boolean;
}

export function TransactionsTable({
  data,
  holding,
  showHoldingColumn = false,
}: TransactionsTableProps) {
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<TransactionWithHolding[]>(
    [],
  );
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const columns = getTransactionColumns({ showHoldingColumn });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        {/* Search */}
        <SearchInput
          className="max-w-sm"
          placeholder="Search transactions..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        {/* New transaction button */}
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
          <p className="mt-3 font-medium">No transactions found</p>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Transactions for this holding will appear here
          </p>
          <NewRecordButton variant="outline" preselectedHolding={holding} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          filterValue={filterValue}
          filterColumnId="description"
          onSelectedRowsChange={setSelectedRows}
        />
      )}

      {/* Rows count */}
      <p className="text-muted-foreground text-end text-sm">
        {data.length} transaction(s)
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
      <DeleteTransactionDialog
        open={openDeleteDialog}
        onOpenChangeAction={setOpenDeleteDialog}
        transactions={selectedRows.map(({ id }) => ({ id }))} // Minimal DTO
        onCompleted={() => {
          setSelectedRows([]);
        }}
      />
    </div>
  );
}
