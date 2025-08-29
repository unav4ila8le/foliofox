"use client";

import { createContext, useContext, useState } from "react";
import { CircleArrowDown, CircleArrowUp, PencilLine, Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoldingSelector } from "./holding-selector";
import { SellForm } from "./forms/sell-form";
import { UpdateForm } from "./forms/update-form";
import {
  getTransactionTypesForCategory,
  getTransactionTypeLabel,
  getTransactionTypeIcon,
} from "@/lib/asset-category-mappings";

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

  // Get available transaction types based on selected holding
  const getAvailableTransactionTypes = () => {
    if (!preselectedHolding) {
      return ["buy", "sell", "update"]; // Default for no selection
    }

    return getTransactionTypesForCategory(preselectedHolding.category_code);
  };

  // Get icon component based on icon name
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "CircleArrowUp":
        return <CircleArrowUp className="size-4" />;
      case "CircleArrowDown":
        return <CircleArrowDown className="size-4" />;
      case "PencilLine":
        return <PencilLine className="size-4" />;
      default:
        return <PencilLine className="size-4" />;
    }
  };

  const availableTypes = getAvailableTransactionTypes();
  const defaultTab = availableTypes[0] + "-form";

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

          {/* Holding selector */}
          <HoldingSelector
            onHoldingSelect={setPreselectedHolding}
            preselectedHolding={preselectedHolding}
            field={{
              value: preselectedHolding?.id || "",
              onChange: () => {},
            }}
          />

          {/* Tabs for transaction types */}
          <Tabs key={defaultTab} defaultValue={defaultTab} className="gap-4">
            <TabsList className="w-full">
              {availableTypes.map((type) => (
                <TabsTrigger
                  key={type}
                  value={`${type}-form`}
                  disabled={!preselectedHolding}
                >
                  {getIconComponent(getTransactionTypeIcon(type))}
                  {getTransactionTypeLabel(type)}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="buy-form">buy form goes here</TabsContent>
            <TabsContent value="sell-form">
              <SellForm />
            </TabsContent>
            <TabsContent value="update-form">
              <UpdateForm />
            </TabsContent>
            <TabsContent value="deposit-form">
              deposit form goes here
            </TabsContent>
            <TabsContent value="withdrawal-form">
              withdrawal form goes here
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
