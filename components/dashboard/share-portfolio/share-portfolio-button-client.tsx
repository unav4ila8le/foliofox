"use client";

import { useState } from "react";
import { Link } from "lucide-react";

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
import { EnableSharing } from "./enable-sharing";

import { enablePublicPortfolio } from "@/server/public-portfolios/enable";
import { disablePublicPortfolio } from "@/server/public-portfolios/disable";
import { updatePublicPortfolioSettings } from "@/server/public-portfolios/update";

import type {
  PublicPortfolioMetadata,
  ShareDuration,
} from "@/types/global.types";
import type { EditSharingFormValues } from "./edit-sharing";

const DEFAULT_DURATION: ShareDuration = "24h";

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
      const result = await enablePublicPortfolio(DEFAULT_DURATION);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to enable public portfolio.");
      }
      setShareMetadata(result.data);
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDisable = async () => {
    setIsDisabling(true);
    try {
      const result = await disablePublicPortfolio();
      if (!result.success) {
        throw new Error(result.error ?? "Failed to disable public portfolio.");
      }
      setShareMetadata(result.data);
    } finally {
      setIsDisabling(false);
    }
  };

  const handleUpdate = async (values: EditSharingFormValues) => {
    setIsUpdating(true);
    try {
      const result = await updatePublicPortfolioSettings(
        values.slug,
        values.duration,
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
          <DialogTitle className="flex items-center gap-2">
            <Link className="size-5" />
            Share your portfolio
          </DialogTitle>
          <DialogDescription>
            Generate a public link and control its availability.
          </DialogDescription>
        </DialogHeader>

        {shareMetadata?.isActive ? (
          <ActiveSharing
            shareMetadata={shareMetadata}
            onDisable={handleDisable}
            onUpdate={handleUpdate}
            isDisabling={isDisabling}
            isUpdating={isUpdating}
          />
        ) : (
          <EnableSharing onEnable={handleEnable} isEnabling={isEnabling} />
        )}
      </DialogContent>
    </Dialog>
  );
}
