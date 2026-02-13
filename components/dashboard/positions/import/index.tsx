"use client";

import { createContext, useContext, useState } from "react";
import { FileText, Sparkles, Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CSVImportForm } from "./csv-form";
import { AIImportForm } from "./ai-form";
import { ImportReviewDialog } from "./review";

import type { VariantProps } from "class-variance-authority";
import type { PositionImportRow } from "@/lib/import/positions/types";
import type { SymbolValidationResult } from "@/server/symbols/validate";

type ImportDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  reviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
  reviewPositions: PositionImportRow[] | null;
  setReviewPositions: (positions: PositionImportRow[] | null) => void;
  reviewSymbolValidation: Record<string, SymbolValidationResult> | null;
  setReviewSymbolValidation: (
    map: Record<string, SymbolValidationResult> | null,
  ) => void;
  reviewSupportedCurrencies: string[] | null;
  setReviewSupportedCurrencies: (codes: string[] | null) => void;
};

const ImportDialogContext = createContext<ImportDialogContextType | undefined>(
  undefined,
);

export function ImportPositionsDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPositions, setReviewPositions] = useState<
    PositionImportRow[] | null
  >(null);
  // Symbol validation
  const [reviewSymbolValidation, setReviewSymbolValidation] = useState<Record<
    string,
    SymbolValidationResult
  > | null>(null);
  // Supported currencies
  const [reviewSupportedCurrencies, setReviewSupportedCurrencies] = useState<
    string[] | null
  >(null);

  return (
    <ImportDialogContext.Provider
      value={{
        open,
        setOpen,
        reviewOpen,
        setReviewOpen,
        reviewPositions,
        setReviewPositions,
        reviewSymbolValidation,
        setReviewSymbolValidation,
        reviewSupportedCurrencies,
        setReviewSupportedCurrencies,
      }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5" />
              Import Assets
            </DialogTitle>
            <DialogDescription className="sr-only">
              Import your assets from a CSV file or AI.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            defaultValue="csv-import"
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <div className="px-6">
              <TabsList className="w-full">
                <TabsTrigger value="csv-import">
                  <FileText className="size-4" /> CSV Import
                </TabsTrigger>
                <TabsTrigger value="ai-import">
                  <Sparkles className="size-4" /> AI Import
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="csv-import"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <CSVImportForm />
            </TabsContent>
            <TabsContent
              value="ai-import"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <AIImportForm />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <ImportReviewDialog />
    </ImportDialogContext.Provider>
  );
}

export function useImportPositionsDialog() {
  const context = useContext(ImportDialogContext);
  if (!context) {
    throw new Error(
      "useImportPositionsDialog must be used within an ImportPositionsDialogProvider",
    );
  }
  return context;
}

export function ImportPositionsButton({
  variant = "default",
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const { setOpen } = useImportPositionsDialog();

  return (
    <Button variant={variant} onClick={() => setOpen(true)}>
      <Upload className="size-4" />
      Import
    </Button>
  );
}
