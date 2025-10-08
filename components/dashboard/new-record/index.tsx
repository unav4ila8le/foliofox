"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";
import {
  CircleArrowDown,
  CircleArrowUp,
  PencilLine,
  Plus,
  Info,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { HoldingSelector } from "./holding-selector";
import { BuyForm } from "./forms/buy-form";
import { SellForm } from "./forms/sell-form";
import { UpdateForm } from "./forms/update-form";

import { getTransactionTypeLabel } from "@/lib/asset-category-mappings";
import { cn } from "@/lib/utils";

import type { TransformedHolding } from "@/types/global.types";
import type { VariantProps } from "class-variance-authority";

const TRANSACTION_TYPE_ICONS: Record<string, React.ElementType> = {
  buy: CircleArrowUp,
  sell: CircleArrowDown,
  update: PencilLine,
};

type NewRecordDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  preselectedHolding: TransformedHolding | null;
  setPreselectedHolding: (holding: TransformedHolding | null) => void;
  setInitialTab: (tab: string | undefined) => void;
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
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);

  // Handle dialog open/close and reset state when closing
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);

    // Clear preselected holding when dialog closes
    if (!isOpen) {
      setPreselectedHolding(null);
      setInitialTab(undefined);
    }
  };

  // Get available transaction types based on holding source
  const getAvailableTransactionTypes = () => {
    if (!preselectedHolding) return [] as string[];
    if (preselectedHolding.source === "symbol")
      return ["buy", "sell", "update"];
    if (preselectedHolding.source === "domain") return [] as string[];
    // Custom (no source): only update
    return ["update"];
  };

  const availableTypes = getAvailableTransactionTypes();
  const defaultTab =
    initialTab ??
    (availableTypes.length > 0 ? availableTypes[0] + "-form" : undefined);

  return (
    <NewRecordDialogContext.Provider
      value={{
        open,
        setOpen,
        preselectedHolding,
        setPreselectedHolding,
        setInitialTab,
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
          <div
            className={cn(
              !preselectedHolding && "pointer-events-none opacity-50",
            )}
          >
            {preselectedHolding && availableTypes.length === 0 ? (
              <Alert>
                <Info className="size-4" />
                <AlertTitle className="line-clamp-none">
                  Domain values are updated automatically. Manual records
                  aren&apos;t needed.
                </AlertTitle>
                <AlertDescription>
                  <p>
                    Domain valuations are provided by{" "}
                    <Link
                      href="https://humbleworth.com"
                      target="_blank"
                      className="hover:text-primary underline underline-offset-2"
                    >
                      HumbleWorth
                    </Link>
                    .
                    <br />
                    If you prefer, you can add a new custom holding to manually
                    enter your own valuation instead.
                  </p>
                </AlertDescription>
              </Alert>
            ) : availableTypes.length > 0 ? (
              <Tabs
                key={defaultTab}
                defaultValue={defaultTab}
                className="gap-4"
              >
                <TabsList
                  className={availableTypes.length > 1 ? "w-full" : "hidden"}
                >
                  {availableTypes.map((type) => {
                    const Icon =
                      TRANSACTION_TYPE_ICONS[type] ??
                      TRANSACTION_TYPE_ICONS.update;
                    return (
                      <TabsTrigger
                        key={type}
                        value={`${type}-form`}
                        disabled={!preselectedHolding}
                      >
                        <Icon className="size-4" />
                        {getTransactionTypeLabel(type)}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {availableTypes.includes("buy") && (
                  <TabsContent value="buy-form">
                    <BuyForm />
                  </TabsContent>
                )}
                {availableTypes.includes("sell") && (
                  <TabsContent value="sell-form">
                    <SellForm />
                  </TabsContent>
                )}
                {availableTypes.includes("update") && (
                  <TabsContent value="update-form">
                    <UpdateForm />
                  </TabsContent>
                )}
              </Tabs>
            ) : null}
          </div>
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
