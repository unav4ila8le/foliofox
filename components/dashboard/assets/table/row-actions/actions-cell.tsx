"use client";

import { useState } from "react";
import { MoreHorizontal, SquarePen, Trash2, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useNewRecordDialog } from "@/components/dashboard/new-record";
import { ArchiveDialog } from "./archive-dialog";
import { DeleteDialog } from "./delete-dialog";

import type { Holding } from "@/types/global.types";

export function ActionsCell({ holding }: { holding: Holding }) {
  const { setOpen, setActiveTab, setPreselectedHolding } = useNewRecordDialog();
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Update holding
  const handleUpdate = () => {
    setPreselectedHolding(holding);
    setActiveTab("update");
    setOpen(true);
  };

  return (
    <>
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
            onSelect={handleUpdate}
            disabled={holding.is_archived}
          >
            <SquarePen className="size-4" /> Update
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setShowArchiveDialog(true)}
            disabled={holding.is_archived}
          >
            <Archive className="size-4" /> Archive
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShowDeleteDialog(true)}>
            <Trash2 className="text-destructive size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchiveDialog
        holding={holding}
        open={showArchiveDialog}
        onOpenChangeAction={setShowArchiveDialog}
      />

      <DeleteDialog
        holding={holding}
        open={showDeleteDialog}
        onOpenChangeAction={setShowDeleteDialog}
      />
    </>
  );
}
