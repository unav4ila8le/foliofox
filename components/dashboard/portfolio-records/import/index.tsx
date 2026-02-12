"use client";

import { createContext, useContext, useState } from "react";
import { Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/custom/dialog";

import { CSVImportForm } from "./csv-form";

import type { VariantProps } from "class-variance-authority";

type ImportPortfolioRecordsDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const ImportPortfolioRecordsDialogContext = createContext<
  ImportPortfolioRecordsDialogContextType | undefined
>(undefined);

export function ImportPortfolioRecordsDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <ImportPortfolioRecordsDialogContext.Provider
      value={{
        open,
        setOpen,
      }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5" />
              Import Records
            </DialogTitle>
            <DialogDescription className="sr-only">
              Import records for your positions from a CSV file.
            </DialogDescription>
          </DialogHeader>
          <CSVImportForm />
        </DialogContent>
      </Dialog>
    </ImportPortfolioRecordsDialogContext.Provider>
  );
}

export function useImportPortfolioRecordsDialog() {
  const context = useContext(ImportPortfolioRecordsDialogContext);
  if (!context) {
    throw new Error(
      "useImportPortfolioRecordsDialog must be used within an ImportPortfolioRecordsDialogProvider",
    );
  }
  return context;
}

export function ImportPortfolioRecordsButton({
  variant = "default",
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const { setOpen } = useImportPortfolioRecordsDialog();

  return (
    <Button variant={variant} onClick={() => setOpen(true)}>
      <Upload className="size-4" />
      Import
    </Button>
  );
}
