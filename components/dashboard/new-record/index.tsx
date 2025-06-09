"use client";

import { createContext, useContext, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { NewRecordForm } from "./form";

import type { Holding } from "@/types/global.types";

type NewRecordDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  preselectedHolding: Holding | null;
  setPreselectedHolding: (holding: Holding | null) => void;
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
  const [preselectedHolding, setPreselectedHolding] = useState<Holding | null>(
    null,
  );

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Record</DialogTitle>
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

export function NewRecordButton() {
  const { setOpen } = useNewRecordDialog();

  return (
    <Button onClick={() => setOpen(true)}>
      <Plus />
      New Record
    </Button>
  );
}
