"use client";

import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  StickyDialogContent,
  StickyDialogHeader,
} from "@/components/ui/custom/sticky-dialog";

import { UpdateAssetForm } from "./form";

import type { Position } from "@/types/global.types";

interface UpdateAssetDialogProps {
  position: Position;
  currentSymbolTicker?: string;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function UpdateAssetDialog({
  position,
  currentSymbolTicker,
  open,
  onOpenChangeAction,
}: UpdateAssetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <StickyDialogContent>
        <StickyDialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription>
            Edit the name, category, tax rate, and description for this asset.
          </DialogDescription>
        </StickyDialogHeader>
        <UpdateAssetForm
          position={position}
          currentSymbolTicker={currentSymbolTicker}
          onSuccess={() => onOpenChangeAction(false)}
        />
      </StickyDialogContent>
    </Dialog>
  );
}
