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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PurchaseForm } from "./purchase-form";
import { SaleForm } from "./sale-form";
import { TransferForm } from "./transfer-form";
import { UpdateForm } from "./update-form";

type NewRecordDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
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
  const [activeTab, setActiveTab] = useState("purchase");

  return (
    <NewRecordDialogContext.Provider
      value={{ open, setOpen, activeTab, setActiveTab }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Record</DialogTitle>
            <DialogDescription>
              Add a new transaction, balance or value update.
            </DialogDescription>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-2 w-full">
              <TabsTrigger value="purchase">Purchase</TabsTrigger>
              <TabsTrigger value="sale">Sale</TabsTrigger>
              <TabsTrigger value="transfer">Transfer</TabsTrigger>
              <TabsTrigger value="update">Update</TabsTrigger>
            </TabsList>
            <TabsContent value="purchase">
              <PurchaseForm />
            </TabsContent>
            <TabsContent value="sale">
              <SaleForm />
            </TabsContent>
            <TabsContent value="transfer">
              <TransferForm />
            </TabsContent>
            <TabsContent value="update">
              <UpdateForm />
            </TabsContent>
          </Tabs>
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
      Add Record
    </Button>
  );
}
