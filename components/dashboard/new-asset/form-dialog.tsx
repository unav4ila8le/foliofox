import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SymbolSearchForm } from "./forms/symbol-search-form";
import { DomainForm } from "./forms/domain-form";
import { ManualEntryForm } from "./forms/manual-entry-form";

import { useNewAssetDialog } from "./index";

export function FormDialog() {
  const { openFormDialog, setOpenFormDialog, selectedType } =
    useNewAssetDialog();

  if (!openFormDialog) return null;

  return (
    <Dialog open={openFormDialog} onOpenChange={setOpenFormDialog}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Asset</DialogTitle>
          <DialogDescription>Add a new asset</DialogDescription>
        </DialogHeader>
        {selectedType === "symbol" && <SymbolSearchForm />}
        {selectedType === "domain" && <DomainForm />}
        {selectedType === "custom" && <ManualEntryForm />}
      </DialogContent>
    </Dialog>
  );
}
