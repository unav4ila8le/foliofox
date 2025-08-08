"use client";

import { createContext, useContext, useState } from "react";
import { Plus, Search, PencilLine } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SymbolSearchForm } from "./forms/symbol-search-form";
import { ManualEntryForm } from "./forms/manual-entry-form";

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
          <Tabs defaultValue="symbol-search-form" className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="symbol-search-form">
                <Search className="size-4" />
                Search by Symbol
              </TabsTrigger>
              <TabsTrigger value="manual-entry-form">
                <PencilLine className="size-4" />
                Enter Manually
              </TabsTrigger>
            </TabsList>
            <TabsContent value="symbol-search-form">
              <SymbolSearchForm />
            </TabsContent>
            <TabsContent value="manual-entry-form">
              <ManualEntryForm />
            </TabsContent>
          </Tabs>
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
