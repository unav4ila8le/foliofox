"use client";

import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  StickyDialogContent,
  StickyDialogHeader,
} from "@/components/ui/custom/sticky-dialog";

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
      <StickyDialogContent>
        <StickyDialogHeader>
          <DialogTitle>Edit Record</DialogTitle>
          <DialogDescription>
            Edit the date, type, quantity, value, and description for this
            record.
          </DialogDescription>
        </StickyDialogHeader>
        <UpdatePortfolioRecordForm
          portfolioRecord={portfolioRecord}
          onSuccess={() => onOpenChangeAction(false)}
        />
      </StickyDialogContent>
    </Dialog>
  );
}
