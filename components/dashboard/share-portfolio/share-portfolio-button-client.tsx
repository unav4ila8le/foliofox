"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ActiveSharing } from "./active-sharing";
import { ToggleSharing } from "./toggle-sharing";

import { enablePublicPortfolio } from "@/server/public-portfolios/enable";
import { disablePublicPortfolio } from "@/server/public-portfolios/disable";
import { updatePublicPortfolioSettings } from "@/server/public-portfolios/update";
import { PUBLIC_PORTFOLIO_EXPIRATIONS } from "@/lib/public-portfolio";
import { cn } from "@/lib/utils";

import type {
  PublicPortfolioMetadata,
  PublicPortfolioExpirationOption,
} from "@/types/global.types";
import type { EditSharingFormValues } from "./edit-sharing";

const DEFAULT_EXPIRATION: PublicPortfolioExpirationOption =
  PUBLIC_PORTFOLIO_EXPIRATIONS[0];

export function SharePortfolioButtonClient({
  initialShareMetadata,
}: {
  initialShareMetadata: PublicPortfolioMetadata | null;
}) {
  const [isEnabling, setIsEnabling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [shareMetadata, setShareMetadata] = useState(initialShareMetadata);
  const [open, setOpen] = useState(false);

  const isAnyPending = isEnabling || isUpdating || isDisabling;

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      const result = await enablePublicPortfolio(DEFAULT_EXPIRATION);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to enable public portfolio.");
      }
      setShareMetadata(result.data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to enable public portfolio.",
      );
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDisable = async () => {
    if (!shareMetadata?.isActive) return;
    setIsDisabling(true);
    try {
      const result = await disablePublicPortfolio();
      if (!result.success) {
        throw new Error(result.error ?? "Failed to disable public portfolio.");
      }
      setShareMetadata(result.data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to disable public portfolio.",
      );
    } finally {
      setIsDisabling(false);
    }
  };

  const handleUpdate = async (values: EditSharingFormValues) => {
    setIsUpdating(true);
    try {
      const result = await updatePublicPortfolioSettings(
        values.slug,
        values.expiration,
      );
      if (!result.success) {
        throw new Error(result.error ?? "Failed to update public link.");
      }
      setShareMetadata(result.data);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={isAnyPending}>
          {shareMetadata?.isActive && (
            <span className="size-2 animate-pulse rounded-full bg-green-500" />
          )}
          Share Portfolio
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share your portfolio</DialogTitle>
          <DialogDescription>
            Generate a public link and control its availability.
          </DialogDescription>
        </DialogHeader>
        <ToggleSharing
          onEnable={handleEnable}
          onDisable={handleDisable}
          isActive={Boolean(shareMetadata?.isActive)}
          isEnabling={isEnabling}
          isDisabling={isDisabling}
        />
        {shareMetadata?.isActive && (
          <div className={cn(isDisabling && "pointer-events-none opacity-50")}>
            <ActiveSharing
              shareMetadata={shareMetadata}
              onUpdate={handleUpdate}
              isUpdating={isUpdating}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
