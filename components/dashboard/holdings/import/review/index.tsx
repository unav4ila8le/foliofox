import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { HoldingsImportReviewTable } from "./table";
import { useImportHoldingsDialog } from "../index";

export function ImportReviewDialog() {
  const { reviewOpen, reviewHoldings, setReviewOpen, setReviewHoldings } =
    useImportHoldingsDialog();

  const handleCancel = () => {
    setReviewOpen(false);
    setReviewHoldings(null);
  };

  const handleImport = () => {
    // TODO: Import holdings
    setReviewOpen(false);
    setReviewHoldings(null);
  };

  if (!reviewOpen || !reviewHoldings) return null;

  return (
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
      <DialogContent className="!max-w-7xl">
        <DialogHeader>
          <DialogTitle>Review Import</DialogTitle>
          <DialogDescription>
            Review and edit your holdings before importing.
          </DialogDescription>
        </DialogHeader>
        <HoldingsImportReviewTable
          initialHoldings={reviewHoldings}
          onCancel={handleCancel}
          onImport={handleImport}
        />
      </DialogContent>
    </Dialog>
  );
}
