"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, Info } from "lucide-react";

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

import { archivePosition, archivePositions } from "@/server/positions/archive";

interface ArchiveDialogProps {
  positions: { id: string; name: string }[]; // Minimal DTO
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onCompleted?: () => void;
}

export function ArchivePositionDialog({
  positions,
  open,
  onOpenChangeAction,
  onCompleted,
}: ArchiveDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!open || positions.length === 0) return null;

  const positionIds = positions.map((position) => position.id);
  const isBulk = positions.length > 1;

  const handleArchive = async () => {
    setIsLoading(true);
    try {
      if (isBulk) {
        const result = await archivePositions(positionIds);
        if (!result.success)
          throw new Error(result.message || "Failed to archive positions");
        toast.success(`${result.count} positions archived successfully`);
      } else {
        const result = await archivePosition(positionIds[0]);
        if (!result.success)
          throw new Error(result.message || "Failed to archive position");
        toast.success("Position archived successfully");
      }
      onCompleted?.();
      onOpenChangeAction(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to archive position(s)",
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
              ? `Archive ${positionIds.length} positions`
              : "Archive Position"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk
              ? "You are about to archive the selected positions. This action cannot be undone."
              : `You are about to archive "${positions[0].name}". This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Alert>
            <Info className="size-4" />
            <AlertTitle>This action will:</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1">
                <li>Hide the position from your main portfolio view</li>
                <li>Preserve all historical data</li>
              </ul>
            </AlertDescription>
          </Alert>
          <p className="text-muted-foreground text-sm">
            Restore this position anytime from the{" "}
            <Link
              href="/dashboard/assets/archived"
              className="text-primary underline-offset-4 hover:underline"
            >
              archived positions
            </Link>{" "}
            page.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button disabled={isLoading} onClick={handleArchive}>
            {isLoading ? (
              <>
                <Spinner /> Archiving...
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
