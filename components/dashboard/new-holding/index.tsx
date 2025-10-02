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

type NewHoldingDialogContextType = {
  openSelectionDialog: boolean;
  setOpenSelectionDialog: (open: boolean) => void;
  openFormDialog: boolean;
  setOpenFormDialog: (open: boolean) => void;
  selectedType: SelectionType;
  setSelectedType: (type: SelectionType) => void;
  profile: Profile;
};

const NewHoldingDialogContext = createContext<
  NewHoldingDialogContextType | undefined
>(undefined);

export function NewHoldingDialogProvider({
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
    <NewHoldingDialogContext.Provider
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
            <DialogTitle>New Holding</DialogTitle>
            <DialogDescription>
              Select a method to add a new holding
            </DialogDescription>
          </DialogHeader>
          <SelectionDialog />
        </DialogContent>
      </Dialog>
    </NewHoldingDialogContext.Provider>
  );
}

export function useNewHoldingDialog() {
  const context = useContext(NewHoldingDialogContext);
  if (!context) {
    throw new Error(
      "useNewHoldingDialog must be used within a NewHoldingDialogProvider",
    );
  }
  return context;
}

export function NewHoldingButton({
  variant = "default",
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const { setOpenSelectionDialog } = useNewHoldingDialog();

  return (
    <Button variant={variant} onClick={() => setOpenSelectionDialog(true)}>
      <Plus />
      New Holding
    </Button>
  );
}
