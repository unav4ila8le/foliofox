import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { SymbolSearchForm } from "./forms/symbol-search-form";
// Sunset 2026-09-22: DomainForm stays in forms/domain-form.tsx but is not mounted.
// import { DomainForm } from "./forms/domain-form";
import { ManualEntryForm } from "./forms/manual-entry-form";

import { useNewAssetDialog } from "./index";

export function FormDialog() {
  const { openFormDialog, setOpenFormDialog, selectedType } =
    useNewAssetDialog();

  if (!openFormDialog) return null;

  return (
    <Dialog open={openFormDialog} onOpenChange={setOpenFormDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Asset</DialogTitle>
          <DialogDescription>Add a new asset</DialogDescription>
        </DialogHeader>
        {selectedType === "symbol" && <SymbolSearchForm />}
        {/*
          Sunset 2026-09-22: new domain positions are closed. Uncomment with
          the Domains card and the createPosition domain_id guard.
        {selectedType === "domain" && <DomainForm />}
        */}
        {selectedType === "custom" && <ManualEntryForm />}
      </DialogContent>
    </Dialog>
  );
}
