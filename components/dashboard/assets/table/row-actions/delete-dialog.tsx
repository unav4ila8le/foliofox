"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LoaderCircle, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { deleteHolding } from "@/server/holdings/delete";

import type { Holding } from "@/types/global.types";

interface DeleteDialogProps {
  holding: Holding;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function DeleteHoldingDialog({
  holding,
  open,
  onOpenChangeAction,
}: DeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const result = await deleteHolding(holding.id);

      if (result.success) {
        toast.success("Holding deleted successfully");
        onOpenChangeAction(false);
      } else {
        throw new Error(result.message || "Failed to delete holding");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete holding",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChangeAction}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Holding?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to permanently delete &quot;{holding.name}&quot;. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <p>This will:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Remove the holding from your portfolio</li>
            <li>Delete all historical data records for this holding</li>
            <li>Remove this holding from your net worth history</li>
            <li>Recalculate your net worth history</li>
          </ul>
          <span className="text-destructive">
            Consider archiving instead if you want to preserve the historical
            data.
          </span>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isLoading}
            onClick={handleDelete}
          >
            {isLoading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" /> Deleting...
              </>
            ) : (
              <>
                <Trash className="size-4" /> Delete
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
