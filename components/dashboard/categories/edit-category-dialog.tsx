"use client";

import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { updateUserPositionCategory } from "@/server/position-categories/update";

interface EditCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: { id: string; name: string } | null;
  positionType: "asset" | "liability";
  onUpdated: (category: { id: string; name: string }) => void | Promise<void>;
}

export function EditCategoryDialog({
  open,
  onOpenChange,
  category,
  positionType,
  onUpdated,
}: EditCategoryDialogProps) {
  const [categoryName, setCategoryName] = useState(category?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCategoryName("");
      setSaveError(null);
    }
  }

  async function handleSaveCategory(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!category) {
      return;
    }

    const normalizedName = categoryName.trim();
    if (!normalizedName) {
      setSaveError("Category name is required.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await updateUserPositionCategory({
        id: category.id,
        name: normalizedName,
        positionType,
      });

      if (!result.success) {
        setSaveError(result.message);
        return;
      }

      await onUpdated(result.category);
      handleOpenChange(false);
      toast.success("Custom category renamed");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to rename custom category.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Rename custom category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSaveCategory} className="flex flex-col gap-4">
          <Field data-invalid={Boolean(saveError)}>
            <FieldLabel htmlFor="edit-custom-category-name">Name</FieldLabel>
            <Input
              id="edit-custom-category-name"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(saveError)}
            />
            {saveError && <FieldError>{saveError}</FieldError>}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !category}>
              {isSaving ? (
                <>
                  <Spinner />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
