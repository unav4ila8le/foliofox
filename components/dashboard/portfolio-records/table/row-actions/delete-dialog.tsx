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
  deletePortfolioRecord,
  deletePortfolioRecords,
} from "@/server/portfolio-records/delete";

interface DeleteDialogProps {
  portfolioRecords: { id: string }[];
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onCompleted?: () => void;
}

export function DeletePortfolioRecordDialog({
  portfolioRecords,
  open,
  onOpenChangeAction,
  onCompleted,
}: DeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!open || portfolioRecords.length === 0) return null;

  const portfolioRecordIds = portfolioRecords.map(
    (portfolioRecord) => portfolioRecord.id,
  );
  const isBulk = portfolioRecords.length > 1;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      if (isBulk) {
        const result = await deletePortfolioRecords(portfolioRecordIds);
        if (!result.success)
          throw new Error(result.message || "Failed to delete records");
        toast.success(`${result.count} records deleted successfully`);
      } else {
        const result = await deletePortfolioRecord(portfolioRecordIds[0]);
        if (!result.success)
          throw new Error(result.message || "Failed to delete record");
        toast.success("Record deleted successfully");
      }
      onCompleted?.();
      onOpenChangeAction(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete record(s)",
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
              ? `Delete ${portfolioRecordIds.length} records`
              : "Delete Record"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk
              ? "You are about to permanently delete the selected records. This action cannot be undone."
              : "You are about to permanently delete this record. This action cannot be undone."}
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
