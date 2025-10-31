"use client";

import { useState } from "react";
import { MoreHorizontal, Archive, Trash2, ArchiveRestore } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ArchivePositionDialog } from "@/components/dashboard/positions/shared/archive-dialog";
import { DeletePositionDialog } from "@/components/dashboard/positions/shared/delete-dialog";

import { useRestorePosition } from "@/hooks/use-restore-positions";

import type { TransformedPosition } from "@/types/global.types";

export function AssetMoreActionsButton({
  position,
}: {
  position: TransformedPosition;
}) {
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { restorePosition, isRestoring } = useRestorePosition();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-auto gap-1 rounded-md px-2 py-0.5 text-xs"
          >
            <MoreHorizontal className="size-3" />
            More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {/* Archive/restore position */}
          {position.is_archived ? (
            <DropdownMenuItem
              onSelect={() => restorePosition(position.id)}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <Spinner />
              ) : (
                <ArchiveRestore className="size-4" />
              )}{" "}
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setShowArchiveDialog(true)}>
              <Archive className="size-4" /> Archive
            </DropdownMenuItem>
          )}
          {/* Delete position */}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 />
            Delete asset
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchivePositionDialog
        positions={[{ id: position.id, name: position.name }]}
        open={showArchiveDialog}
        onOpenChangeAction={setShowArchiveDialog}
      />
      <DeletePositionDialog
        positions={[{ id: position.id, name: position.name }]}
        open={showDeleteDialog}
        onOpenChangeAction={setShowDeleteDialog}
      />
    </>
  );
}
