"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { UpdateHoldingForm } from "./form";

import type { Holding } from "@/types/global.types";

interface UpdateHoldingDialogProps {
  holding: Holding;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function UpdateHoldingDialog({
  holding,
  open,
  onOpenChangeAction,
}: UpdateHoldingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Holding</DialogTitle>
          <DialogDescription>
            Edit the name, category, currency, and description for this holding.
          </DialogDescription>
        </DialogHeader>
        <UpdateHoldingForm
          holding={holding}
          onSuccess={() => onOpenChangeAction(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
