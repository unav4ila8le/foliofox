"use client";

import { createContext, useContext, useState } from "react";
import { FileText, Sparkles, Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CSVImportForm } from "./csv-form";
import { AIImportForm } from "./ai-form";
import { ImportReviewDialog } from "./review";

import type { VariantProps } from "class-variance-authority";
import type { HoldingRow } from "@/lib/import/types";

type ImportDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  reviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
  reviewHoldings: HoldingRow[] | null;
  setReviewHoldings: (holdings: HoldingRow[] | null) => void;
};

const ImportDialogContext = createContext<ImportDialogContextType | undefined>(
  undefined,
);

export function ImportHoldingsDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewHoldings, setReviewHoldings] = useState<HoldingRow[] | null>(
    null,
  );

  return (
    <ImportDialogContext.Provider
      value={{
        open,
        setOpen,
        reviewOpen,
        setReviewOpen,
        reviewHoldings,
        setReviewHoldings,
      }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5" />
              Import Holdings
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="csv-import" className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="csv-import">
                <FileText className="size-4" /> CSV Import
              </TabsTrigger>
              <TabsTrigger value="ai-import">
                <Sparkles className="size-4" /> AI Import
              </TabsTrigger>
            </TabsList>
            <TabsContent value="csv-import">
              <CSVImportForm />
            </TabsContent>
            <TabsContent value="ai-import">
              <AIImportForm />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <ImportReviewDialog />
    </ImportDialogContext.Provider>
  );
}

export function useImportHoldingsDialog() {
  const context = useContext(ImportDialogContext);
  if (!context) {
    throw new Error(
      "useImportHoldingsDialog must be used within an ImportHoldingsDialogProvider",
    );
  }
  return context;
}

export function ImportHoldingsButton({
  variant = "default",
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const { setOpen } = useImportHoldingsDialog();

  return (
    <Button variant={variant} onClick={() => setOpen(true)}>
      <Upload className="size-4" />
      Import
    </Button>
  );
}
