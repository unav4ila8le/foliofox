"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useState } from "react";
import { Upload } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { Skeleton } from "@/components/ui/custom/skeleton";

const BrokerImportCSVForm = dynamic(
  () =>
    import("./csv-form").then((module) => ({
      default: module.BrokerImportCSVForm,
    })),
  {
    loading: () => <BrokerImportDialogSkeleton />,
  },
);

type BrokerImportDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const BrokerImportDialogContext = createContext<
  BrokerImportDialogContextType | undefined
>(undefined);

function BrokerImportDialogSkeleton() {
  return (
    <div className="space-y-4 px-6 pb-6">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function BrokerImportDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <BrokerImportDialogContext.Provider value={{ open, setOpen }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5" />
              Broker Import
            </DialogTitle>
            <DialogDescription className="sr-only">
              Import positions and transactions from a broker export.
            </DialogDescription>
          </DialogHeader>
          {open ? <BrokerImportCSVForm /> : null}
        </DialogContent>
      </Dialog>
    </BrokerImportDialogContext.Provider>
  );
}

export function useBrokerImportDialog() {
  const context = useContext(BrokerImportDialogContext);
  if (!context) {
    throw new Error(
      "useBrokerImportDialog must be used within a BrokerImportDialogProvider",
    );
  }
  return context;
}
