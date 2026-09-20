"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { deletePositionTag } from "@/server/position-tags/actions";
import type { PositionTag } from "@/server/position-tags/types";
import { usePositionTags, TagDataStatus } from "./provider";
import { TagBadge } from "./tag-badge";
import { TagEditorDialog } from "./tag-editor-dialog";

export function ManageTagsDialog({ onClose }: { onClose: () => void }) {
  const state = usePositionTags()!;
  const [editing, setEditing] = useState<PositionTag | "new" | null>(null);
  const [deleting, setDeleting] = useState<PositionTag | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (!deleting) return;
    setPending(true);
    setError(null);
    try {
      const result = await deletePositionTag(deleting.id);
      if (!result.success) {
        if (result.outcomeUnknown) await state.refresh();
        setError(result.message);
        return;
      }
      setDeleting(null);
      await state.refresh();
    } catch {
      setError(
        "The deletion outcome could not be confirmed. Refresh tags before retrying.",
      );
      await state.refresh().catch(() => {});
    } finally {
      setPending(false);
    }
  }
  const disabled = pending || state.isRefreshing || Boolean(state.error);
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !pending) onClose();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage tags</DialogTitle>
            <DialogDescription>
              Organize assets without changing their categories or values.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <TagDataStatus />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!state.data?.tags.length ? (
              <p className="text-muted-foreground py-4 text-sm">
                Create your first tag, such as Dad or Retirement.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {state.data.tags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center justify-between gap-3 p-2 ps-3"
                  >
                    <TagBadge tag={tag} className="max-w-full min-w-0 shrink" />
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        aria-label={`Edit ${tag.name}`}
                        onClick={() => setEditing(tag)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        aria-label={`Delete ${tag.name}`}
                        onClick={() => {
                          setError(null);
                          setDeleting(tag);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={disabled}
              onClick={() => setEditing("new")}
            >
              <Plus data-icon="inline-start" />
              Create tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {editing && (
        <TagEditorDialog
          tag={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tag from every asset, including archived assets.
              Your assets and their financial records are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={() => void remove()}
            >
              {pending && <Spinner />}Delete tag
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
