"use client";

import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { createContext, useContext, useState } from "react";

import { Button, type buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { Skeleton } from "@/components/ui/custom/skeleton";

import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import type { Profile } from "@/types/global.types";
import type { VariantProps } from "class-variance-authority";

const SelectionDialog = dynamic(
  () =>
    import("./selection-dialog").then((module) => ({
      default: module.SelectionDialog,
    })),
  {
    loading: () => <NewAssetSelectionSkeleton />,
  },
);

function NewAssetSelectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-21 sm:h-31" />
      ))}
    </div>
  );
}

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Asset</DialogTitle>
            <DialogDescription>
              Select a method to add a new asset
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {openSelectionDialog ? <SelectionDialog /> : null}
          </DialogBody>
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
