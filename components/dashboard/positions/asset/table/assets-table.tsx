"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Archive, Package, TagPlus, Tags, TagX, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/custom/search-input";
import { NewAssetButton } from "@/components/dashboard/new-asset";
import { DeletePositionDialog } from "@/components/dashboard/positions/shared/delete-dialog";
import { ArchivePositionDialog } from "@/components/dashboard/positions/shared/archive-dialog";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import { BulkActionBar } from "@/components/dashboard/tables/base/bulk-action-bar";
import {
  PositionTagsProvider,
  TagDataStatus,
  usePositionTags,
} from "@/components/dashboard/position-tags/provider";
import { TagPicker } from "@/components/dashboard/position-tags/tag-picker";
import { TagBadge } from "@/components/dashboard/position-tags/tag-badge";
import { ManageTagsDialog } from "@/components/dashboard/position-tags/manage-tags-dialog";
import { BulkTagsDialog } from "@/components/dashboard/position-tags/bulk-tags-dialog";
import type { PositionTag } from "@/server/position-tags/types";
import { TableActionsDropdown } from "./table-actions";
import { createAssetColumns } from "./columns";
import { UpdateAssetDialog } from "@/components/dashboard/positions/asset/update";
import type { AssetTableRow } from "./types";

export function AssetsTable({
  data,
  tags,
}: {
  data: AssetTableRow[];
  tags: PositionTag[];
}) {
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
      <AssetsTableContent data={data} />
    </PositionTagsProvider>
  );
}

function AssetsTableContent({ data }: { data: AssetTableRow[] }) {
  const router = useRouter();
  const state = usePositionTags()!;
  const [filterValue, setFilterValue] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<AssetTableRow[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openArchiveDialog, setOpenArchiveDialog] = useState(false);
  const [manage, setManage] = useState(false);
  const [bulk, setBulk] = useState<"add" | "remove" | null>(null);
  const [editing, setEditing] = useState<AssetTableRow | null>(null);
  const columns = useMemo(() => createAssetColumns(setEditing), []);
  const tagData = state.data!;
  // Deleted definitions cannot remain active filters or hidden selections.
  const activeFilters = useMemo(
    () => tagFilter.filter((id) => tagData.tags.some((tag) => tag.id === id)),
    [tagFilter, tagData.tags],
  );
  const [previousFilters, setPreviousFilters] = useState(activeFilters);
  if (previousFilters !== activeFilters) {
    setPreviousFilters(activeFilters);
    if (previousFilters.join() !== activeFilters.join()) {
      setSelectedRows([]);
      setResetKey(resetKey + 1);
    }
  }
  const rows = useMemo(() => {
    const byPosition = new Map<string, string[]>();
    for (const { position_id, tag_id } of tagData.assignments) {
      const ids = byPosition.get(position_id) ?? [];
      ids.push(tag_id);
      byPosition.set(position_id, ids);
    }
    return data.map((position) => ({
      ...position,
      tagIds: byPosition.get(position.id) ?? [],
    }));
  }, [data, tagData.assignments]);
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.name
            .toLocaleLowerCase()
            .includes(filterValue.trim().toLocaleLowerCase()) &&
          activeFilters.every((id) => row.tagIds.includes(id)),
      ),
    [rows, filterValue, activeFilters],
  );
  const visibleSelection = useMemo(() => {
    const selected = new Set(selectedRows.map((row) => row.id));
    return visibleRows.filter((row) => selected.has(row.id));
  }, [visibleRows, selectedRows]);
  const handleRowClick = useCallback(
    (position: AssetTableRow) =>
      router.push(`/dashboard/assets/${position.id}`),
    [router],
  );
  function clearSelection() {
    setSelectedRows([]);
    setResetKey((key) => key + 1);
  }
  function clearFilters() {
    setFilterValue("");
    setTagFilter([]);
    clearSelection();
  }
  const isFiltered = Boolean(filterValue.trim() || activeFilters.length);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchInput
          className="w-full sm:max-w-sm"
          id="assets-search"
          name="assets-search"
          aria-label="Search assets"
          autoComplete="off"
          placeholder="Search assets…"
          value={filterValue}
          onChange={(event) => {
            setFilterValue(event.target.value);
            clearSelection();
          }}
        />
        <div className="flex items-center gap-2">
          <NewAssetButton variant="outline" />
          <TableActionsDropdown positionsCount={data.length} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TagPicker
          selectedIds={activeFilters}
          onChange={setTagFilter}
          label={
            activeFilters.length ? `Tags (${activeFilters.length})` : "Tags"
          }
          description="Match all selected tags"
          allowCreate={false}
          hideSelection
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setManage(true)}
        >
          <Tags data-icon="inline-start" />
          Manage tags
        </Button>
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            <X data-icon="inline-start" />
            Clear filters
          </Button>
        )}
      </div>
      {activeFilters.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Active tag filters"
        >
          <span className="text-muted-foreground text-sm">Match all:</span>
          {tagData.tags
            .filter((tag) => activeFilters.includes(tag.id))
            .map((tag) => (
              <Button
                key={tag.id}
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${tag.name} filter`}
                onClick={() =>
                  setTagFilter(activeFilters.filter((id) => id !== tag.id))
                }
              >
                <TagBadge tag={tag} />
                <X data-icon="inline-end" />
              </Button>
            ))}
        </div>
      )}
      <TagDataStatus />
      {data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Package className="text-muted-foreground size-5" />
          <p>No assets yet</p>
          <p className="text-muted-foreground text-sm">
            Add your first asset, then use tags to organize it.
          </p>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={visibleRows}
            onRowClick={handleRowClick}
            onSelectedRowsChange={setSelectedRows}
            selectionResetKey={resetKey}
            enableGrouping
            groupBy={["display_category_id"]}
            defaultSorting={[{ id: "name", desc: false }]}
          />
          {visibleRows.length === 0 && (
            <p className="text-muted-foreground text-center text-sm">
              No assets match these filters. Try fewer tags or clear the search.
            </p>
          )}
        </>
      )}
      <p role="status" className="text-muted-foreground text-end text-sm">
        {visibleRows.length} of {data.length} assets
      </p>
      {visibleSelection.length > 0 && (
        <BulkActionBar
          selectedCount={visibleSelection.length}
          className="max-w-[calc(100vw-2rem)] flex-wrap justify-end"
          actions={[
            {
              label: "Add tags",
              onClick: () => setBulk("add"),
              icon: <TagPlus />,
              disabled: state.isRefreshing || Boolean(state.error),
            },
            {
              label: "Remove tags",
              onClick: () => setBulk("remove"),
              icon: <TagX />,
              disabled: state.isRefreshing || Boolean(state.error),
            },
            {
              label: "Archive selected",
              onClick: () => setOpenArchiveDialog(true),
              icon: <Archive />,
              variant: "outline",
            },
            {
              label: "Delete selected",
              onClick: () => setOpenDeleteDialog(true),
              icon: <Trash2 />,
              variant: "destructive",
            },
          ]}
        />
      )}
      <DeletePositionDialog
        open={openDeleteDialog && visibleSelection.length > 0}
        onOpenChangeAction={setOpenDeleteDialog}
        positions={visibleSelection.map(({ id, name }) => ({ id, name }))}
        onCompleted={clearSelection}
      />
      <ArchivePositionDialog
        open={openArchiveDialog && visibleSelection.length > 0}
        onOpenChangeAction={setOpenArchiveDialog}
        positions={visibleSelection.map(({ id, name }) => ({ id, name }))}
        onCompleted={clearSelection}
      />
      {manage && <ManageTagsDialog onClose={() => setManage(false)} />}
      {editing && (
        <UpdateAssetDialog
          position={rows.find((row) => row.id === editing.id) ?? editing}
          currentSymbolTicker={editing.symbol_ticker}
          open
          onOpenChangeAction={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
      {bulk && visibleSelection.length > 0 && (
        <BulkTagsDialog
          operation={bulk}
          positionIds={visibleSelection.map((row) => row.id)}
          onClose={() => setBulk(null)}
          onCompleted={() => {
            setBulk(null);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}
