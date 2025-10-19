"use client";

import { useState } from "react";
import { FileText, Trash2, Search } from "lucide-react";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import { getPortfolioRecordColumns } from "@/components/dashboard/portfolio-records/table/columns";
import { NewPortfolioRecordButton } from "@/components/dashboard/new-portfolio-record";
import { BulkActionBar } from "@/components/dashboard/tables/base/bulk-action-bar";
import { DeletePortfolioRecordDialog } from "@/components/dashboard/portfolio-records/table/row-actions/delete-dialog";

import type {
  PortfolioRecordWithPosition,
  TransformedPosition,
} from "@/types/global.types";

interface PortfolioRecordsTableProps {
  data: PortfolioRecordWithPosition[];
  position?: TransformedPosition;
  showPositionColumn?: boolean;
}

export function PortfolioRecordsTable({
  data,
  position,
  showPositionColumn = false,
}: PortfolioRecordsTableProps) {
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<
    PortfolioRecordWithPosition[]
  >([]);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const columns = getPortfolioRecordColumns({ showPositionColumn });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        {/* Search */}
        <InputGroup className="max-w-sm">
          <InputGroupInput
            placeholder="Search records..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        {/* New record button */}
        {data.length > 0 && (
          <NewPortfolioRecordButton
            variant="outline"
            preselectedPosition={position}
          />
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
            Records for this position will appear here
          </p>
          <NewPortfolioRecordButton
            variant="outline"
            preselectedPosition={position}
          />
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
      <DeletePortfolioRecordDialog
        open={openDeleteDialog}
        onOpenChangeAction={setOpenDeleteDialog}
        portfolioRecords={selectedRows.map(({ id }) => ({ id }))} // Minimal DTO
        onCompleted={() => {
          setSelectedRows([]);
        }}
      />
    </div>
  );
}
