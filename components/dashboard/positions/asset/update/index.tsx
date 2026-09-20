"use client";

import { useState } from "react";
import {
  PositionTagsProvider,
  TagDataStatus,
  usePositionTags,
} from "@/components/dashboard/position-tags/provider";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";

import { UpdateAssetForm } from "./form";

import type { Position } from "@/types/global.types";

interface UpdateAssetDialogProps {
  position: Position;
  currentSymbolTicker?: string | null;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function UpdateAssetDialog({
  position,
  currentSymbolTicker,
  open,
  onOpenChangeAction,
}: UpdateAssetDialogProps) {
  const tags = usePositionTags();
  const [isSaving, setIsSaving] = useState(false);
  const editor = (
    <AssetEditor
      position={position}
      currentSymbolTicker={currentSymbolTicker}
      onSavingChange={setIsSaving}
      onSuccess={() => onOpenChangeAction(false)}
    />
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) onOpenChangeAction(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>
            Edit this asset’s details and tags, then choose Save changes to
            apply your edits.
          </DialogDescription>
        </DialogHeader>
        {open &&
          (tags ? (
            editor
          ) : (
            <PositionTagsProvider positionId={position.id}>
              {editor}
            </PositionTagsProvider>
          ))}
      </DialogContent>
    </Dialog>
  );
}

function AssetEditor(props: React.ComponentProps<typeof UpdateAssetForm>) {
  const tags = usePositionTags();
  return tags?.data ? (
    <UpdateAssetForm {...props} />
  ) : (
    <div className="px-6 pb-6">
      <TagDataStatus />
    </div>
  );
}
