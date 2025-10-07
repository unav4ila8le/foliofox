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

import { useNewRecordDialog } from "@/components/dashboard/new-record";
import { ArchiveHoldingDialog } from "./archive-dialog";
import { DeleteHoldingDialog } from "./delete-dialog";

import { restoreHolding } from "@/server/holdings/restore";

import type { TransformedHolding } from "@/types/global.types";

export function ActionsCell({ holding }: { holding: TransformedHolding }) {
  const { setOpen, setPreselectedHolding, setInitialTab } =
    useNewRecordDialog();
  const [isRestoring, setIsRestoring] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get available transaction types based on holding source
  const getAvailableTransactionTypes = () => {
    if (holding.source === "symbol") return ["buy", "sell", "update"];
    if (holding.source === "domain") return [];
    // Custom (no source): only update
    return ["update"];
  };

  const availableTypes = getAvailableTransactionTypes();

  // New update record
  const handleNewUpdateRecord = () => {
    setPreselectedHolding(holding);
    setInitialTab("update-form");
    setOpen(true);
  };

  // New buy record
  const handleNewBuyRecord = () => {
    setPreselectedHolding(holding);
    setInitialTab("buy-form");
    setOpen(true);
  };

  // New sell record
  const handleNewSellRecord = () => {
    setPreselectedHolding(holding);
    setInitialTab("sell-form");
    setOpen(true);
  };

  // Restore holding
  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const result = await restoreHolding(holding.id);
      if (result.success) {
        toast.success("Holding restored successfully");
      } else {
        throw new Error(result.message || "Failed to restore holding");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to restore holding",
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
            disabled={holding.is_archived}
          >
            <SquarePen className="size-4" /> Update value
          </DropdownMenuItem>

          {/* New buy record */}
          {availableTypes.includes("buy") && (
            <DropdownMenuItem
              onSelect={handleNewBuyRecord}
              disabled={holding.is_archived}
            >
              <CirclePlus className="size-4" /> Buy record
            </DropdownMenuItem>
          )}

          {/* New sell record */}
          {availableTypes.includes("sell") && (
            <DropdownMenuItem
              onSelect={handleNewSellRecord}
              disabled={holding.is_archived}
            >
              <CircleMinus className="size-4" /> Sell record
            </DropdownMenuItem>
          )}

          {/* Archive/restore holding */}
          {holding.is_archived ? (
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

          {/* Delete holding */}
          <DropdownMenuItem
            onSelect={() => setShowDeleteDialog(true)}
            variant="destructive"
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchiveHoldingDialog
        holdings={[{ id: holding.id, name: holding.name }]} // Minimal DTO
        open={showArchiveDialog}
        onOpenChangeAction={setShowArchiveDialog}
      />

      <DeleteHoldingDialog
        holdings={[{ id: holding.id, name: holding.name }]} // Minimal DTO
        open={showDeleteDialog}
        onOpenChangeAction={setShowDeleteDialog}
      />
    </div>
  );
}
