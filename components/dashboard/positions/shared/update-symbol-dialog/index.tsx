"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Ticker Symbol</DialogTitle>
          <DialogDescription>
            {currentSymbolTicker
              ? `Update the ticker symbol linked to this position. Currently using ${currentSymbolTicker}.`
              : "Link a new ticker symbol to this position for market data."}
          </DialogDescription>
        </DialogHeader>
        <UpdateSymbolForm
          positionId={positionId}
          currentSymbolTicker={currentSymbolTicker}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChangeAction(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
