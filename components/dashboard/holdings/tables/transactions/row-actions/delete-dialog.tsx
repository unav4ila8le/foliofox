"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  deleteTransaction,
  deleteTransactions,
} from "@/server/transactions/delete";

interface DeleteDialogProps {
  transactions: { id: string }[];
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onCompleted?: () => void;
}

export function DeleteTransactionDialog({
  transactions,
  open,
  onOpenChangeAction,
  onCompleted,
}: DeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!open || transactions.length === 0) return null;

  const transactionIds = transactions.map((transaction) => transaction.id);
  const isBulk = transactions.length > 1;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      if (isBulk) {
        const result = await deleteTransactions(transactionIds);
        if (!result.success)
          throw new Error(result.message || "Failed to delete transactions");
        toast.success(`${result.count} transactions deleted successfully`);
      } else {
        const result = await deleteTransaction(transactionIds[0]);
        if (!result.success)
          throw new Error(result.message || "Failed to delete transaction");
        toast.success("Transaction deleted successfully");
      }
      onCompleted?.();
      onOpenChangeAction(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete transaction(s)",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChangeAction}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5" />{" "}
            {isBulk
              ? `Delete ${transactionIds.length} transactions`
              : "Delete Transaction"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk
              ? "You are about to permanently delete the selected transactions. This action cannot be undone."
              : "You are about to permanently delete this transaction. This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button disabled={isLoading} onClick={handleDelete}>
            {isLoading ? (
              <>
                <Spinner /> Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
