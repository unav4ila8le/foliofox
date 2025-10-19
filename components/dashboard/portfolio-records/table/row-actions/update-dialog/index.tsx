"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { UpdatePortfolioRecordForm } from "./form";

import type { PortfolioRecordWithPosition } from "@/types/global.types";

interface UpdatePortfolioRecordDialogProps {
  portfolioRecord: PortfolioRecordWithPosition;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function UpdatePortfolioRecordDialog({
  portfolioRecord,
  open,
  onOpenChangeAction,
}: UpdatePortfolioRecordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Record</DialogTitle>
          <DialogDescription>
            Edit the date, type, quantity, value, and description for this
            record.
          </DialogDescription>
        </DialogHeader>
        <UpdatePortfolioRecordForm
          portfolioRecord={portfolioRecord}
          onSuccess={() => onOpenChangeAction(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
