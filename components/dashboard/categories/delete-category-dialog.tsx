"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { deleteUserPositionCategory } from "@/server/position-categories/delete";

import type { UserPositionCategoryListItem } from "@/server/position-categories/types";

interface DeleteCategoryDialogProps {
  category: UserPositionCategoryListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionType: "asset" | "liability";
  onDeleted: (categoryId: string) => void | Promise<void>;
}

function formatPositionCount(positionCount: number) {
  return positionCount === 1 ? "1 position" : `${positionCount} positions`;
}

export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
  positionType,
  onDeleted,
}: DeleteCategoryDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!open || !category) {
    return null;
  }

  const categoryToDelete = category;

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const result = await deleteUserPositionCategory({
        id: categoryToDelete.id,
        positionType,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to delete custom category.");
      }

      await onDeleted(categoryToDelete.id);
      onOpenChange(false);
      toast.success("Custom category deleted");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete custom category.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5" />
            Delete &ldquo;{categoryToDelete.name}&rdquo;
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {categoryToDelete.position_count > 0 ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>
              Used by {formatPositionCount(categoryToDelete.position_count)}
            </AlertTitle>
            <AlertDescription>
              Those positions will lose this custom label and appear under the
              system category &ldquo;Others&rdquo; in tables, charts, and
              filters.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertCircle />
            <AlertTitle>No positions use this category</AlertTitle>
            <AlertDescription>
              Deleting it will only remove the category from your list.
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <>
                <Spinner />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                Delete category
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
