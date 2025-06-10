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

import { NewHoldingForm } from "./form";

import type { Profile } from "@/types/global.types";
import type { VariantProps } from "class-variance-authority";

type NewHoldingDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
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
  const [open, setOpen] = useState(false);

  return (
    <NewHoldingDialogContext.Provider value={{ open, setOpen, profile }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Holding</DialogTitle>
            <DialogDescription>Add a new holding.</DialogDescription>
          </DialogHeader>
          <NewHoldingForm />
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
  const { setOpen } = useNewHoldingDialog();

  return (
    <Button variant={variant} onClick={() => setOpen(true)}>
      <Plus />
      New Holding
    </Button>
  );
}
