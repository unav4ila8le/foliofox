import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { HoldingsImportReviewTable } from "./table";
import { useImportHoldingsDialog } from "../index";

import { importHoldings } from "@/server/holdings/import";
import { holdingsToCSV } from "@/lib/import/serialize";

import type { HoldingRow } from "@/lib/import/types";

export function ImportReviewDialog() {
  const {
    setOpen,
    reviewOpen,
    reviewHoldings,
    setReviewOpen,
    setReviewHoldings,
    reviewSymbolValidation,
    reviewSupportedCurrencies,
    setReviewSymbolValidation,
    setReviewSupportedCurrencies,
  } = useImportHoldingsDialog();

  const handleCancel = () => {
    setReviewOpen(false);
    setReviewHoldings(null);
    setReviewSymbolValidation(null);
    setReviewSupportedCurrencies(null);
  };

  const handleImport = async (rows: HoldingRow[]) => {
    const csv = holdingsToCSV(rows);
    return await importHoldings(csv);
  };

  const handleSuccess = () => {
    setReviewOpen(false);
    setReviewHoldings(null);
    setReviewSymbolValidation(null);
    setReviewSupportedCurrencies(null);
    setOpen(false);
  };

  if (!reviewOpen || !reviewHoldings) return null;

  return (
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="flex h-[100dvh] !max-w-7xl flex-col rounded-none border-0 md:h-[80dvh] md:rounded-lg md:border"
      >
        <DialogHeader className="flex-none">
          <DialogTitle>Review Import</DialogTitle>
          <DialogDescription>
            Review and edit your holdings before importing.
          </DialogDescription>
        </DialogHeader>
        <HoldingsImportReviewTable
          initialHoldings={reviewHoldings}
          onCancel={handleCancel}
          onImport={handleImport}
          onSuccess={handleSuccess}
          precomputedSymbolValidation={reviewSymbolValidation ?? undefined}
          supportedCurrencies={reviewSupportedCurrencies ?? undefined}
        />
      </DialogContent>
    </Dialog>
  );
}
