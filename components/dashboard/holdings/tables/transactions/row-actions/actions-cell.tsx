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

import { UpdateTransactionDialog } from "./update-transaction";
import { DeleteTransactionDialog } from "./delete-dialog";

import type { Transaction } from "@/types/global.types";

export function ActionsCell({ transaction }: { transaction: Transaction }) {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="size-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setShowUpdateDialog(true)}>
            <SquarePen className="size-4" /> Edit transaction
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setShowDeleteDialog(true)}
            variant="destructive"
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateTransactionDialog
        transaction={transaction}
        open={showUpdateDialog}
        onOpenChangeAction={setShowUpdateDialog}
      />

      <DeleteTransactionDialog
        transactions={[{ id: transaction.id }]} // Minimal DTO
        open={showDeleteDialog}
        onOpenChangeAction={setShowDeleteDialog}
      />
    </>
  );
}
