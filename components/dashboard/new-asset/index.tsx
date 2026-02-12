"use client";

import { createContext, useContext, useState } from "react";
import { Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  StickyDialogBody,
  StickyDialogContent,
  StickyDialogHeader,
} from "@/components/ui/custom/sticky-dialog";
import { SelectionDialog } from "./selection-dialog";

import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
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
}: {
  children: React.ReactNode;
}) {
  const { profile } = useDashboardData();
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
        <StickyDialogContent>
          <StickyDialogHeader>
            <DialogTitle>New Asset</DialogTitle>
            <DialogDescription>
              Select a method to add a new asset
            </DialogDescription>
          </StickyDialogHeader>
          <StickyDialogBody>
            <SelectionDialog />
          </StickyDialogBody>
        </StickyDialogContent>
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
