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

import { NewRecordForm } from "./form";

import type { TransformedHolding } from "@/types/global.types";
import type { VariantProps } from "class-variance-authority";

type NewRecordDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  preselectedHolding: TransformedHolding | null;
  setPreselectedHolding: (holding: TransformedHolding | null) => void;
};

const NewRecordDialogContext = createContext<
  NewRecordDialogContextType | undefined
>(undefined);

export function NewRecordDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [preselectedHolding, setPreselectedHolding] =
    useState<TransformedHolding | null>(null);

  // Handle dialog open/close and reset state when closing
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);

    // Clear preselected holding when dialog closes
    if (!isOpen) {
      setPreselectedHolding(null);
    }
  };

  return (
    <NewRecordDialogContext.Provider
      value={{
        open,
        setOpen,
        preselectedHolding,
        setPreselectedHolding,
      }}
    >
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {preselectedHolding
                ? `New Record for ${preselectedHolding.name}`
                : "New Record"}
            </DialogTitle>
            <DialogDescription>
              Update the value and quantity of your holdings.
            </DialogDescription>
          </DialogHeader>
          <NewRecordForm />
        </DialogContent>
      </Dialog>
    </NewRecordDialogContext.Provider>
  );
}

export function useNewRecordDialog() {
  const context = useContext(NewRecordDialogContext);
  if (!context) {
    throw new Error(
      "useNewRecordDialog must be used within a NewRecordDialogProvider",
    );
  }
  return context;
}

export function NewRecordButton({
  variant = "default",
  preselectedHolding,
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  preselectedHolding?: TransformedHolding;
}) {
  const { setOpen, setPreselectedHolding } = useNewRecordDialog();

  const handleClick = () => {
    if (preselectedHolding) {
      setPreselectedHolding(preselectedHolding ?? null);
    }
    setOpen(true);
  };

  return (
    <Button variant={variant} onClick={handleClick}>
      <Plus />
      New Record
    </Button>
  );
}
