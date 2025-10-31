"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { UpdatePositionForm } from "./form";

import type { Position } from "@/types/global.types";

interface UpdatePositionDialogProps {
  position: Position;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function UpdatePositionDialog({
  position,
  open,
  onOpenChangeAction,
}: UpdatePositionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Position</DialogTitle>
          <DialogDescription>
            Edit the name, category, and description for this position.
          </DialogDescription>
        </DialogHeader>
        <UpdatePositionForm
          position={position}
          onSuccess={() => onOpenChangeAction(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
