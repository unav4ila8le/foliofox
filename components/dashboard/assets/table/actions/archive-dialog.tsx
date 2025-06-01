"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

import { archiveHolding } from "@/server/holdings/archive";

import type { Holding } from "@/types/global.types";

interface ArchiveDialogProps {
  holding: Holding;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function ArchiveDialog({
  holding,
  open,
  onOpenChangeAction,
}: ArchiveDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleArchive = async () => {
    setIsLoading(true);
    try {
      const result = await archiveHolding(holding.id);

      if (result.success) {
        toast.success("Holding archived successfully");
        onOpenChangeAction(false);
      } else {
        throw new Error(result.message || "Failed to archive holding");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive holding",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChangeAction}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive holding?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to archive &quot;{holding.name}&quot;. This will hide
            it from your main portfolio view.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <p>This will:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Hide the holding from your main portfolio view</li>
            <li>Preserve all historical data</li>
          </ul>
          <span className="text-muted-foreground">
            You can restore this holding later from the archived holdings
            section.
          </span>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button disabled={isLoading} onClick={handleArchive}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Archiving...
              </>
            ) : (
              "Archive"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
