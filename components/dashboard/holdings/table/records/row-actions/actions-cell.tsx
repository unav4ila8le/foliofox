"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { UpdateRecordDialog } from "./update-record";
import { DeleteRecordDialog } from "./delete-dialog";

import type { TransformedRecord } from "@/types/global.types";

export function ActionsCell({ record }: { record: TransformedRecord }) {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
          <DropdownMenuItem onSelect={() => setShowUpdateDialog(true)}>
            <SquarePen className="size-4" /> Edit record
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShowDeleteDialog(true)}>
            <Trash2 className="text-destructive size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateRecordDialog
        record={record}
        open={showUpdateDialog}
        onOpenChangeAction={setShowUpdateDialog}
      />

      <DeleteRecordDialog
        record={record}
        open={showDeleteDialog}
        onOpenChangeAction={setShowDeleteDialog}
      />
    </>
  );
}
