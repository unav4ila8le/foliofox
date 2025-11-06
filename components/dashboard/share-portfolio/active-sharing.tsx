"use client";

import { Check, Copy } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EditSharing, type EditSharingFormValues } from "./edit-sharing";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

import type { PublicPortfolioMetadata } from "@/types/global.types";

type ActiveSharingProps = {
  shareMetadata: PublicPortfolioMetadata;
  onUpdate: (values: EditSharingFormValues) => Promise<void> | void;
  isUpdating?: boolean;
};

export function ActiveSharing({
  shareMetadata,
  onUpdate,
  isUpdating = false,
}: ActiveSharingProps) {
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Your public link is active. Share the URL below or adjust its settings.
      </p>

      <div className="space-y-2">
        <InputGroup>
          <InputGroupInput
            value={shareMetadata.shareUrl}
            readOnly
            disabled={isUpdating}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              variant="secondary"
              onClick={() => copyToClipboard(shareMetadata.shareUrl)}
              disabled={isUpdating}
            >
              {isCopied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-muted-foreground text-xs">
          <span
            className={cn(
              "mr-1.5 inline-block size-2 animate-pulse rounded-full",
              shareMetadata.isActive ? "bg-green-500" : "bg-red-600",
            )}
          />
          {shareMetadata.neverExpires
            ? "Never expires"
            : shareMetadata.expiresAt
              ? `Expires on ${new Date(
                  shareMetadata.expiresAt,
                ).toLocaleString()}`
              : "No expiration date set"}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <EditSharing
          shareMetadata={shareMetadata}
          onSubmit={onUpdate}
          isUpdating={isUpdating}
        />
      </div>
    </div>
  );
}
