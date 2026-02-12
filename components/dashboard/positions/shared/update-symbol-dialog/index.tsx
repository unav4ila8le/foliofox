"use client";

import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  StickyDialogContent,
  StickyDialogHeader,
} from "@/components/ui/custom/sticky-dialog";

import { UpdateSymbolForm } from "./form";

interface UpdateSymbolDialogProps {
  positionId: string;
  currentSymbolTicker?: string;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UpdateSymbolDialog({
  positionId,
  currentSymbolTicker,
  open,
  onOpenChangeAction,
  onSuccess,
}: UpdateSymbolDialogProps) {
  const handleSuccess = () => {
    onSuccess?.();
    onOpenChangeAction(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <StickyDialogContent>
        <StickyDialogHeader>
          <DialogTitle>Change Ticker Symbol</DialogTitle>
          <DialogDescription>
            {currentSymbolTicker
              ? `Update the ticker symbol linked to this position. Currently using ${currentSymbolTicker}.`
              : "Link a new ticker symbol to this position for market data."}
          </DialogDescription>
        </StickyDialogHeader>
        <UpdateSymbolForm
          positionId={positionId}
          currentSymbolTicker={currentSymbolTicker}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChangeAction(false)}
        />
      </StickyDialogContent>
    </Dialog>
  );
}
