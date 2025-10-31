"use client";

import { useState } from "react";
import {
  MoreHorizontal,
  Trash2,
  Archive,
  ArchiveRestore,
  SquarePen,
  CircleMinus,
  CirclePlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useNewPortfolioRecordDialog } from "@/components/dashboard/new-portfolio-record";
import { ArchivePositionDialog } from "@/components/dashboard/positions/shared/archive-dialog";
import { DeletePositionDialog } from "@/components/dashboard/positions/shared/delete-dialog";

import { useRestorePosition } from "@/hooks/use-restore-positions";

import type { TransformedPosition } from "@/types/global.types";
import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";

export function ActionsCell({ position }: { position: TransformedPosition }) {
  const { setOpen, setPreselectedPosition, setInitialTab } =
    useNewPortfolioRecordDialog();
  const { restorePosition, isRestoring } = useRestorePosition();

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get available record types based on position source
  const getAvailableRecordTypes = () => {
    if (position.symbol_id) return PORTFOLIO_RECORD_TYPES;
    if (position.domain_id) return [];
    // Custom (no source): only update
    return ["update"];
  };

  const availableTypes = getAvailableRecordTypes();

  // New update record
  const handleNewUpdateRecord = () => {
    setPreselectedPosition(position);
    setInitialTab("update-form");
    setOpen(true);
  };

  // New buy record
  const handleNewBuyRecord = () => {
    setPreselectedPosition(position);
    setInitialTab("buy-form");
    setOpen(true);
  };

  // New sell record
  const handleNewSellRecord = () => {
    setPreselectedPosition(position);
    setInitialTab("sell-form");
    setOpen(true);
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="size-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* New update record */}
          <DropdownMenuItem
            onSelect={handleNewUpdateRecord}
            disabled={position.is_archived}
          >
            <SquarePen className="size-4" /> Update value
          </DropdownMenuItem>

          {/* New buy record */}
          {availableTypes.includes("buy") && (
            <DropdownMenuItem
              onSelect={handleNewBuyRecord}
              disabled={position.is_archived}
            >
              <CirclePlus className="size-4" /> Buy record
            </DropdownMenuItem>
          )}

          {/* New sell record */}
          {availableTypes.includes("sell") && (
            <DropdownMenuItem
              onSelect={handleNewSellRecord}
              disabled={position.is_archived}
            >
              <CircleMinus className="size-4" /> Sell record
            </DropdownMenuItem>
          )}

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
          <DropdownMenuSeparator />

          {/* Delete position */}
          <DropdownMenuItem
            onSelect={() => setShowDeleteDialog(true)}
            variant="destructive"
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchivePositionDialog
        positions={[{ id: position.id, name: position.name }]} // Minimal DTO
        open={showArchiveDialog}
        onOpenChangeAction={setShowArchiveDialog}
      />

      <DeletePositionDialog
        positions={[{ id: position.id, name: position.name }]} // Minimal DTO
        open={showDeleteDialog}
        onOpenChangeAction={setShowDeleteDialog}
      />
    </div>
  );
}
