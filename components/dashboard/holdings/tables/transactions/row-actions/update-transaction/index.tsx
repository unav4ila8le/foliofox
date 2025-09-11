"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { UpdateTransactionForm } from "./form";

import type { Transaction } from "@/types/global.types";

interface UpdateTransactionDialogProps {
  transaction: Transaction;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function UpdateTransactionDialog({
  transaction,
  open,
  onOpenChangeAction,
}: UpdateTransactionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Edit the date, type, quantity, value, and description for this
            transaction.
          </DialogDescription>
        </DialogHeader>
        <UpdateTransactionForm
          transaction={transaction}
          onSuccess={() => onOpenChangeAction(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
