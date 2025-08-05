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

import { archiveHolding } from "@/server/holdings/archive";

import type { Holding } from "@/types/global.types";

interface ArchiveDialogProps {
  holding: Holding;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function ArchiveHoldingDialog({
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
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="size-5" /> Archive Holding
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are about to archive &quot;{holding.name}&quot;.
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
              href="/dashboard/assets/archived"
              className="text-primary underline-offset-2 hover:underline"
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
