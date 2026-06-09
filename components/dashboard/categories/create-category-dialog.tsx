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

import { createUserPositionCategory } from "@/server/position-categories/create";

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionType: "asset" | "liability";
  onCreated: (category: { id: string; name: string }) => void | Promise<void>;
}

export function CreateCategoryDialog({
  open,
  onOpenChange,
  positionType,
  onCreated,
}: CreateCategoryDialogProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setNewCategoryName("");
      setCreateError(null);
    }
  }

  async function handleCreateCategory(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    const normalizedName = newCategoryName.trim();
    if (!normalizedName) {
      setCreateError("Category name is required.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await createUserPositionCategory({
        name: normalizedName,
        positionType,
      });

      if (!result.success) {
        setCreateError(result.message);
        return;
      }

      await onCreated(result.category);
      setNewCategoryName("");
      handleOpenChange(false);
      toast.success(
        result.created ? "Custom category created" : "Custom category selected",
      );
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Failed to create custom category.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add a custom category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
          <Field data-invalid={Boolean(createError)}>
            <FieldLabel htmlFor="custom-category-name">Name</FieldLabel>
            <Input
              id="custom-category-name"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(createError)}
            />
            {createError && <FieldError>{createError}</FieldError>}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
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
