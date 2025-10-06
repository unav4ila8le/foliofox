"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Info, Trash2 } from "lucide-react";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { deleteHolding, deleteHoldings } from "@/server/holdings/delete";

interface DeleteDialogProps {
  holdings: { id: string; name: string }[]; // Minimal DTO
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onCompleted?: () => void;
}

export function DeleteHoldingDialog({
  holdings,
  open,
  onOpenChangeAction,
  onCompleted,
}: DeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!open || holdings.length === 0) return null;

  const holdingIds = holdings.map((holding) => holding.id);
  const isBulk = holdings.length > 1;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      if (isBulk) {
        const result = await deleteHoldings(holdingIds);
        if (!result.success)
          throw new Error(result.message || "Failed to delete holdings");
        toast.success(`${result.count} holdings deleted successfully`);
      } else {
        const result = await deleteHolding(holdingIds[0]);
        if (!result.success)
          throw new Error(result.message || "Failed to delete holding");
        toast.success("Holding deleted successfully");
      }
      onCompleted?.();
      onOpenChangeAction(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete holding(s)",
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
            {isBulk ? `Delete ${holdingIds.length} holdings` : "Delete Holding"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk
              ? "You are about to permanently delete the selected holdings. This action cannot be undone."
              : `You are about to permanently delete "${holdings[0].name}". This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>This action will:</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1">
                <li>Remove the holding from your portfolio</li>
                <li>Delete all historical data records for this holding</li>
                <li>Remove this holding from your net worth history</li>
                <li>Recalculate your net worth history</li>
              </ul>
            </AlertDescription>
          </Alert>
          <Alert>
            <Info className="size-4" />
            <AlertTitle>Consider archiving instead</AlertTitle>
            <AlertDescription>
              If you want to preserve the historical data, consider archiving
              instead.
            </AlertDescription>
          </Alert>
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
                <Spinner /> Deleting...
              </>
            ) : (
              <>
                <Trash2 className="size-4" /> Delete
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
