"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription>
            Edit the name, category, currency, and description for this asset.
          </DialogDescription>
        </DialogHeader>
        <UpdateAssetForm
          position={position}
          currentSymbolTicker={currentSymbolTicker}
          onSuccess={() => onOpenChangeAction(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
