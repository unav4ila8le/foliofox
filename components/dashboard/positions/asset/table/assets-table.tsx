"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Archive, Package, Trash2, Search } from "lucide-react";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { NewAssetButton } from "@/components/dashboard/new-asset";
import { TableActionsDropdown } from "./table-actions";
import { DeletePositionDialog } from "@/components/dashboard/positions/shared/delete-dialog";
import { ArchivePositionDialog } from "@/components/dashboard/positions/shared/archive-dialog";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import { BulkActionBar } from "@/components/dashboard/tables/base/bulk-action-bar";
import { columns } from "./columns";

import type { PositionWithProfitLoss } from "@/types/global.types";

interface AssetsTableProps {
  data: PositionWithProfitLoss[];
}

export function AssetsTable({ data }: AssetsTableProps) {
  const router = useRouter();
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<PositionWithProfitLoss[]>(
    [],
  );
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openArchiveDialog, setOpenArchiveDialog] = useState(false);

  // Handle row click to navigate to asset page
  const handleRowClick = useCallback(
    (position: PositionWithProfitLoss) => {
      router.push(`/dashboard/assets/${position.id}`);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <InputGroup className="max-w-sm">
          <InputGroupInput
            placeholder="Search assets..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex items-center gap-2">
          <NewAssetButton variant="outline" />
          <TableActionsDropdown positionsCount={data.length} />
        </div>
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-accent rounded-lg p-2">
            <Package className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">No assets found</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Start building your portfolio by adding your first asset
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          filterValue={filterValue}
          onRowClick={handleRowClick}
          onSelectedRowsChange={setSelectedRows}
          enableGrouping={true}
          groupBy={["category_id"]}
          defaultSorting={[{ id: "name", desc: false }]}
        />
      )}

      {/* Rows count */}
      <p className="text-muted-foreground text-end text-sm">
        {data.length} asset(s)
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
      <DeletePositionDialog
        open={openDeleteDialog}
        onOpenChangeAction={setOpenDeleteDialog}
        positions={selectedRows.map(({ id, name }) => ({ id, name }))} // Minimal DTO
        onCompleted={() => {
          setSelectedRows([]);
        }}
      />

      {/* Archive dialog */}
      <ArchivePositionDialog
        open={openArchiveDialog}
        onOpenChangeAction={setOpenArchiveDialog}
        positions={selectedRows.map(({ id, name }) => ({ id, name }))} // Minimal DTO
        onCompleted={() => {
          setSelectedRows([]);
        }}
      />
    </div>
  );
}
