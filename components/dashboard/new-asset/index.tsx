"use client";

import { createContext, useContext, useState } from "react";
import { Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectionDialog } from "./selection-dialog";

import type { Profile } from "@/types/global.types";
import type { VariantProps } from "class-variance-authority";

export type SelectionType = "symbol" | "domain" | "custom";

type NewAssetDialogContextType = {
  openSelectionDialog: boolean;
  setOpenSelectionDialog: (open: boolean) => void;
  openFormDialog: boolean;
  setOpenFormDialog: (open: boolean) => void;
  selectedType: SelectionType;
  setSelectedType: (type: SelectionType) => void;
  profile: Profile;
};

const NewAssetDialogContext = createContext<
  NewAssetDialogContextType | undefined
>(undefined);

export function NewAssetDialogProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: Profile;
}) {
  const [openSelectionDialog, setOpenSelectionDialog] = useState(false);
  const [openFormDialog, setOpenFormDialog] = useState(false);
  const [selectedType, setSelectedType] = useState<SelectionType>("custom");

  return (
    <NewAssetDialogContext.Provider
      value={{
        openSelectionDialog,
        setOpenSelectionDialog,
        openFormDialog,
        setOpenFormDialog,
        selectedType,
        setSelectedType,
        profile,
      }}
    >
      {children}
      <Dialog open={openSelectionDialog} onOpenChange={setOpenSelectionDialog}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Asset</DialogTitle>
            <DialogDescription>
              Select a method to add a new asset
            </DialogDescription>
          </DialogHeader>
          <SelectionDialog />
        </DialogContent>
      </Dialog>
    </NewAssetDialogContext.Provider>
  );
}

export function useNewAssetDialog() {
  const context = useContext(NewAssetDialogContext);
  if (!context) {
    throw new Error(
      "useNewAssetDialog must be used within a NewAssetDialogProvider",
    );
  }
  return context;
}

export function NewAssetButton({
  variant = "default",
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const { setOpenSelectionDialog } = useNewAssetDialog();

  return (
    <Button variant={variant} onClick={() => setOpenSelectionDialog(true)}>
      <Plus />
      New Asset
    </Button>
  );
}
