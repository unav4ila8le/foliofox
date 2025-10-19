"use client";

import { useState } from "react";
import { toast } from "sonner";
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

import { useNewRecordDialog } from "@/components/dashboard/new-portfolio-record";
import { ArchivePositionDialog } from "./archive-dialog";
import { DeletePositionDialog } from "./delete-dialog";

import { restorePosition } from "@/server/positions/restore";

import type { TransformedPosition } from "@/types/global.types";

export function ActionsCell({ position }: { position: TransformedPosition }) {
  const { setOpen, setPreselectedPosition, setInitialTab } =
    useNewRecordDialog();
  const [isRestoring, setIsRestoring] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get available transaction types based on position source
  const getAvailableTransactionTypes = () => {
    if (position.symbol_id) return ["buy", "sell", "update"];
    if (position.domain_id) return [];
    // Custom (no source): only update
    return ["update"];
  };

  const availableTypes = getAvailableTransactionTypes();

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

  // Restore holding
  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const result = await restorePosition(position.id);
      if (result.success) {
        toast.success("Position restored successfully");
      } else {
        throw new Error(result.message || "Failed to restore position");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to restore position",
      );
    } finally {
      setIsRestoring(false);
    }
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
            <DropdownMenuItem onSelect={handleRestore} disabled={isRestoring}>
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
