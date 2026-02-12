import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  StickyDialogContent,
  StickyDialogHeader,
} from "@/components/ui/custom/sticky-dialog";
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
      <StickyDialogContent>
        <StickyDialogHeader>
          <DialogTitle>New Asset</DialogTitle>
          <DialogDescription>Add a new asset</DialogDescription>
        </StickyDialogHeader>
        {selectedType === "symbol" && <SymbolSearchForm />}
        {selectedType === "domain" && <DomainForm />}
        {selectedType === "custom" && <ManualEntryForm />}
      </StickyDialogContent>
    </Dialog>
  );
}
