"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { LoaderCircle, Archive, Info } from "lucide-react";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { archiveHolding, archiveHoldings } from "@/server/holdings/archive";

interface ArchiveDialogProps {
  holdings: { id: string; name: string }[]; // Minimal DTO
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onCompleted?: () => void;
}

export function ArchiveHoldingDialog({
  holdings,
  open,
  onOpenChangeAction,
  onCompleted,
}: ArchiveDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!open || holdings.length === 0) return null;

  const holdingIds = holdings.map((holding) => holding.id);
  const isBulk = holdings.length > 1;

  const handleArchive = async () => {
    setIsLoading(true);
    try {
      if (isBulk) {
        const result = await archiveHoldings(holdingIds);
        if (!result.success)
          throw new Error(result.message || "Failed to archive holdings");
        toast.success(`${result.count} holdings archived successfully`);
      } else {
        const result = await archiveHolding(holdingIds[0]);
        if (!result.success)
          throw new Error(result.message || "Failed to archive holding");
        toast.success("Holding archived successfully");
      }
      onCompleted?.();
      onOpenChangeAction(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive holding(s)",
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
            <Archive className="size-5" />{" "}
            {isBulk
              ? `Archive ${holdingIds.length} holdings`
              : "Archive Holding"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk
              ? "You are about to archive the selected holdings. This action cannot be undone."
              : `You are about to archive "${holdings[0].name}". This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Alert>
            <Info className="size-4" />
            <AlertTitle>This action will:</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1">
                <li>Hide the holding from your main portfolio view</li>
                <li>Preserve all historical data</li>
              </ul>
            </AlertDescription>
          </Alert>
          <p className="text-muted-foreground text-sm">
            Restore this holding anytime from the{" "}
            <Link
              href="/dashboard/holdings/archived"
              className="text-primary underline-offset-4 hover:underline"
            >
              archived holdings
            </Link>{" "}
            page.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button disabled={isLoading} onClick={handleArchive}>
            {isLoading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" /> Archiving...
              </>
            ) : (
              <>
                <Archive className="size-4" /> Archive
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
