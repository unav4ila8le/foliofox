"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { UpdateRecordForm } from "./form";

import type { Record } from "@/types/global.types";

interface UpdateRecordDialogProps {
  record: Record;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function UpdateRecordDialog({
  record,
  open,
  onOpenChangeAction,
}: UpdateRecordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Record</DialogTitle>
          <DialogDescription>
            Edit the date, quantity, value, and description for this record.
          </DialogDescription>
        </DialogHeader>
        <UpdateRecordForm
          record={record}
          onSuccess={() => onOpenChangeAction(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
