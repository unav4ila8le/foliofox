"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Trash2,
  Archive,
  ArchiveRestore,
  Plus,
  SquarePen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useNewRecordDialog } from "@/components/dashboard/new-record";
import { UpdateHoldingDialog } from "@/components/dashboard/update-holding";
import { restoreHolding } from "@/server/holdings/restore";
import { ArchiveHoldingDialog } from "./archive-dialog";
import { DeleteHoldingDialog } from "./delete-dialog";

import type { Holding } from "@/types/global.types";

export function ActionsCell({ holding }: { holding: Holding }) {
  const { setOpen, setPreselectedHolding } = useNewRecordDialog();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // New record
  const handleNewRecord = () => {
    setPreselectedHolding(holding);
    setOpen(true);
  };

  // Restore holding
  const handleRestore = async () => {
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
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="size-8 p-0 opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100 md:opacity-0"
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={handleNewRecord}
            disabled={holding.is_archived}
          >
            <Plus className="size-4" /> New record
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setShowUpdateDialog(true)}
            disabled={holding.is_archived}
          >
            <SquarePen className="size-4" /> Edit holding
          </DropdownMenuItem>
          {holding.is_archived ? (
            <DropdownMenuItem onSelect={handleRestore}>
              <ArchiveRestore className="size-4" /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setShowArchiveDialog(true)}>
              <Archive className="size-4" /> Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShowDeleteDialog(true)}>
            <Trash2 className="text-destructive size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateHoldingDialog
        holding={holding}
        open={showUpdateDialog}
        onOpenChangeAction={setShowUpdateDialog}
      />

      <ArchiveHoldingDialog
        holding={holding}
        open={showArchiveDialog}
        onOpenChangeAction={setShowArchiveDialog}
      />

      <DeleteHoldingDialog
        holding={holding}
        open={showDeleteDialog}
        onOpenChangeAction={setShowDeleteDialog}
      />
    </div>
  );
}
