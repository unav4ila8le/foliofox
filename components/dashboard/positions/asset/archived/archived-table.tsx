"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ArchiveRestore } from "lucide-react";

import { SearchInput } from "@/components/ui/custom/search-input";
import { BulkActionBar } from "@/components/dashboard/tables/base/bulk-action-bar";
import { DeletePositionDialog } from "@/components/dashboard/positions/shared/delete-dialog";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import {
  PositionTagsProvider,
  TagDataStatus,
  usePositionTags,
} from "@/components/dashboard/position-tags/provider";
import { columns, type ArchivedAssetRow } from "./columns";

import { useRestorePosition } from "@/hooks/use-restore-positions";

import type { PositionTag } from "@/server/position-tags/types";

interface ArchivedTableProps {
  data: ArchivedAssetRow[];
  tags: PositionTag[];
}

export function ArchivedAssetsTable({ data, tags }: ArchivedTableProps) {
  const initialData = useMemo(
    () => ({
      tags,
      assignments: data.flatMap((position) =>
        position.tagIds.map((tag_id) => ({ position_id: position.id, tag_id })),
      ),
    }),
    [data, tags],
  );
  return (
    <PositionTagsProvider initialData={initialData}>
      <ArchivedAssetsTableContent data={data} />
    </PositionTagsProvider>
  );
}

function ArchivedAssetsTableContent({ data }: { data: ArchivedAssetRow[] }) {
  const [filterValue, setFilterValue] = useState("");
  const state = usePositionTags()!;
  const [selectedRows, setSelectedRows] = useState<ArchivedAssetRow[]>([]);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const router = useRouter();
  const { restorePositions, isRestoring } = useRestorePosition();

  // Handle row click to navigate to asset page
  const rows = useMemo(() => {
    const byPosition = new Map<string, string[]>();
    for (const { position_id, tag_id } of state.data?.assignments ?? []) {
      const ids = byPosition.get(position_id) ?? [];
      ids.push(tag_id);
      byPosition.set(position_id, ids);
    }
    return data.map((position) => ({
      ...position,
      tagIds: byPosition.get(position.id) ?? [],
    }));
  }, [data, state.data?.assignments]);

  const handleRowClick = useCallback(
    (position: ArchivedAssetRow) => {
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
      <SearchInput
        className="max-w-sm"
        placeholder="Search archived assets..."
        value={filterValue}
        onChange={(e) => setFilterValue(e.target.value)}
      />

      <TagDataStatus />

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        filterValue={filterValue}
        onRowClick={handleRowClick}
        onSelectedRowsChange={setSelectedRows}
        defaultSorting={[
          { id: "archived_at", desc: true },
          { id: "name", desc: false },
        ]}
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
