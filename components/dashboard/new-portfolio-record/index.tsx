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
import { PositionSelector } from "./position-selector";
import { BuyForm } from "./forms/buy-form";
import { SellForm } from "./forms/sell-form";
import { UpdateForm } from "./forms/update-form";

import { cn } from "@/lib/utils";

import type { TransformedPosition } from "@/types/global.types";
import type { VariantProps } from "class-variance-authority";
import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";

const RECORD_TYPE_ICONS: Record<string, React.ElementType> = {
  buy: CircleArrowUp,
  sell: CircleArrowDown,
  update: PencilLine,
};

type NewPortfolioRecordDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  preselectedPosition: TransformedPosition | null;
  setPreselectedPosition: (position: TransformedPosition | null) => void;
  setInitialTab: (tab: string | undefined) => void;
};

const NewPortfolioRecordDialogContext = createContext<
  NewPortfolioRecordDialogContextType | undefined
>(undefined);

export function NewPortfolioRecordDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [preselectedPosition, setPreselectedPosition] =
    useState<TransformedPosition | null>(null);
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);

  // Handle dialog open/close and reset state when closing
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);

    // Clear preselected position when dialog closes
    if (!isOpen) {
      setPreselectedPosition(null);
      setInitialTab(undefined);
    }
  };

  // Get available record types based on position source
  const getAvailableRecordTypes = () => {
    if (!preselectedPosition) return [];
    if (preselectedPosition.symbol_id) return PORTFOLIO_RECORD_TYPES;
    if (preselectedPosition.domain_id) return [];
    // Custom (no source): only update
    return ["update"];
  };

  const availableTypes = getAvailableRecordTypes();
  const defaultTab =
    initialTab ??
    (availableTypes.length > 0 ? availableTypes[0] + "-form" : undefined);

  return (
    <NewPortfolioRecordDialogContext.Provider
      value={{
        open,
        setOpen,
        preselectedPosition,
        setPreselectedPosition,
        setInitialTab,
      }}
    >
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {preselectedPosition
                ? `New Record for ${preselectedPosition.name}`
                : "New Record"}
            </DialogTitle>
            <DialogDescription>
              Update the value and quantity of your positions.
            </DialogDescription>
          </DialogHeader>

          {/* position selector */}
          <PositionSelector
            onPositionSelect={setPreselectedPosition}
            preselectedPosition={preselectedPosition}
            field={{
              value: preselectedPosition?.id || "",
              onChange: () => {},
            }}
          />

          {/* Tabs for record types */}
          <div
            className={cn(
              !preselectedPosition && "pointer-events-none opacity-50",
            )}
          >
            {preselectedPosition && availableTypes.length === 0 ? (
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
                    If you prefer, you can add a new custom position to manually
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
                    const Icon = RECORD_TYPE_ICONS[type];
                    return (
                      <TabsTrigger
                        key={type}
                        value={`${type}-form`}
                        disabled={!preselectedPosition}
                        className="capitalize"
                      >
                        <Icon className="size-4" />
                        {type}
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
    </NewPortfolioRecordDialogContext.Provider>
  );
}

export function useNewPortfolioRecordDialog() {
  const context = useContext(NewPortfolioRecordDialogContext);
  if (!context) {
    throw new Error(
      "useNewPortfolioRecordDialog must be used within a NewPortfolioRecordDialogProvider",
    );
  }
  return context;
}

export function NewPortfolioRecordButton({
  variant = "default",
  preselectedPosition,
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  preselectedPosition?: TransformedPosition;
}) {
  const { setOpen, setPreselectedPosition } = useNewPortfolioRecordDialog();

  const handleClick = () => {
    if (preselectedPosition) {
      setPreselectedPosition(preselectedPosition);
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
