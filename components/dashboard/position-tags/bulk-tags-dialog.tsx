"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/custom/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  addPositionTags,
  removePositionTags,
} from "@/server/position-tags/actions";
import { TagPicker } from "./tag-picker";
import { usePositionTags, TagDataStatus } from "./provider";

export function BulkTagsDialog({
  operation,
  positionIds,
  onClose,
  onCompleted,
}: {
  operation: "add" | "remove";
  positionIds: string[];
  onClose: () => void;
  onCompleted: () => void;
}) {
  const state = usePositionTags()!;
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tagIds = selected.filter((id) =>
    state.data?.tags.some((tag) => tag.id === id),
  );
  const label = operation === "add" ? "Add tags" : "Remove tags";
  async function submit() {
    if (!positionIds.length || !tagIds.length) return;
    setPending(true);
    setError(null);
    try {
      const result = await (
        operation === "add" ? addPositionTags : removePositionTags
      )({ positionIds, tagIds });
      if (!result.success) {
        setError(result.message);
        if (result.outcomeUnknown) await state.refresh();
        return;
      }
      await state.refresh().catch(() => {});
      onCompleted();
    } catch {
      setError("The save outcome is unknown. Refresh tags before retrying.");
      await state.refresh().catch(() => {});
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {label} {operation === "add" ? "to" : "from"}{" "}
            {positionIds.length === 1
              ? "1 selected asset"
              : `${positionIds.length} selected assets`}
            . Other tags stay unchanged.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <TagDataStatus />
          <TagPicker
            selectedIds={tagIds}
            onChange={setSelected}
            label="Choose tags"
            description="Choose the tags to apply to this selection."
            disabled={pending}
            allowCreate={operation === "add"}
          />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              pending ||
              !positionIds.length ||
              !tagIds.length ||
              state.isRefreshing ||
              Boolean(state.error)
            }
            onClick={() => void submit()}
          >
            {pending && <Spinner />}
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
