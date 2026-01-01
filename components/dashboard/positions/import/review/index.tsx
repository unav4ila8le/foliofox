import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { PositionsImportReviewTable } from "./table";
import { useImportPositionsDialog } from "../index";

import { importPositionsFromCSV } from "@/server/positions/import";
import { positionsToCSV } from "@/lib/import/positions/serialize";

import type { PositionImportRow } from "@/lib/import/positions/types";

export function ImportReviewDialog() {
  const {
    setOpen,
    reviewOpen,
    reviewPositions,
    setReviewOpen,
    setReviewPositions,
    reviewSymbolValidation,
    reviewSupportedCurrencies,
    setReviewSymbolValidation,
    setReviewSupportedCurrencies,
  } = useImportPositionsDialog();

  const handleCancel = () => {
    setReviewOpen(false);
    setReviewPositions(null);
    setReviewSymbolValidation(null);
    setReviewSupportedCurrencies(null);
  };

  const handleImport = async (rows: PositionImportRow[]) => {
    const csv = positionsToCSV(rows);
    return await importPositionsFromCSV(csv, "asset");
  };

  const handleSuccess = () => {
    setReviewOpen(false);
    setReviewPositions(null);
    setReviewSymbolValidation(null);
    setReviewSupportedCurrencies(null);
    setOpen(false);
  };

  if (!reviewOpen || !reviewPositions) return null;

  return (
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="h-100dvh flex max-w-7xl! flex-col rounded-none border-0 md:h-[80dvh] md:rounded-lg md:border"
      >
        <DialogHeader className="flex-none">
          <DialogTitle>Review Import</DialogTitle>
          <DialogDescription>
            Review and edit your positions before importing.
          </DialogDescription>
        </DialogHeader>
        <PositionsImportReviewTable
          initialPositions={reviewPositions}
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
