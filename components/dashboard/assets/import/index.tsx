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

import { ImportForm } from "./form";

import type { VariantProps } from "class-variance-authority";

type ImportDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
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

  return (
    <ImportDialogContext.Provider value={{ open, setOpen }}>
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
              <TabsTrigger value="ai-import" disabled>
                <Sparkles className="size-4" /> AI Import (Coming Soon)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="csv-import">
              <ImportForm />
            </TabsContent>
            <TabsContent value="ai-import">AI Import</TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
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
      Import from CSV
    </Button>
  );
}
