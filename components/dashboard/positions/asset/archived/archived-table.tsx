"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ArchiveRestore, Search } from "lucide-react";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { BulkActionBar } from "@/components/dashboard/tables/base/bulk-action-bar";
import { DeletePositionDialog } from "@/components/dashboard/positions/shared/delete-dialog";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import { columns } from "./columns";

import { useRestorePosition } from "@/hooks/use-restore-positions";

import type { TransformedPosition } from "@/types/global.types";

interface ArchivedTableProps {
  data: TransformedPosition[];
}

export function ArchivedAssetsTable({ data }: ArchivedTableProps) {
  const [filterValue, setFilterValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<TransformedPosition[]>([]);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const router = useRouter();
  const { restorePositions, isRestoring } = useRestorePosition();

  // Handle row click to navigate to asset page
  const handleRowClick = useCallback(
    (position: TransformedPosition) => {
      router.push(`/dashboard/assets/${position.id}`);
    },
    [router],
  );

  // Handle restore selected
  const handleRestoreSelected = async () => {
    await restorePositions(selectedRows.map((row) => row.id));
    setSelectedRows([]);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <InputGroup className="max-w-sm">
        <InputGroupInput
          placeholder="Search archived assets..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        filterValue={filterValue}
        onRowClick={handleRowClick}
        onSelectedRowsChange={setSelectedRows}
      />

      {/* Rows count */}
      <p className="text-muted-foreground text-end text-sm">
        {data.length} archived asset(s)
      </p>

      {/* Floating bulk action bar */}
      {selectedRows.length > 0 && (
        <BulkActionBar
          selectedCount={selectedRows.length}
          actions={[
            {
              label: "Restore selected",
              onClick: handleRestoreSelected,
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
      <DeletePositionDialog
        open={openDeleteDialog}
        onOpenChangeAction={setOpenDeleteDialog}
        positions={selectedRows.map(({ id, name }) => ({ id, name }))} // Minimal DTO
        onCompleted={() => {
          setSelectedRows([]);
        }}
      />
    </div>
  );
}
