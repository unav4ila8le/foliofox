"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { deleteRecord } from "@/server/records/delete";

import type { TransformedRecord } from "@/types/global.types";

interface DeleteDialogProps {
  record: TransformedRecord;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function DeleteRecordDialog({
  record,
  open,
  onOpenChangeAction,
}: DeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const result = await deleteRecord(record.id);

      if (result.success) {
        toast.success("Record deleted successfully");
        onOpenChangeAction(false);
      } else {
        throw new Error(result.message || "Failed to delete record");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete record",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChangeAction}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete record?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to permanently delete this record. This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isLoading} onClick={handleDelete}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
