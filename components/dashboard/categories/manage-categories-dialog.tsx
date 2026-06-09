"use client";

import { useCallback, useState } from "react";
import { Pencil, PlusIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { Spinner } from "@/components/ui/spinner";

import { CreateCategoryDialog } from "@/components/dashboard/categories/create-category-dialog";
import { DeleteCategoryDialog } from "@/components/dashboard/categories/delete-category-dialog";
import { EditCategoryDialog } from "@/components/dashboard/categories/edit-category-dialog";
import { fetchUserPositionCategoriesWithUsage } from "@/server/position-categories/fetch";

import type { UserPositionCategoryListItem } from "@/server/position-categories/types";

interface ManageCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionType: "asset" | "liability";
  onCategoriesChanged?: () => void | Promise<void>;
  onCategoryDeleted?: (categoryId: string) => void;
}

function formatPositionCount(positionCount: number) {
  return positionCount === 1 ? "1 position" : `${positionCount} positions`;
}

export function ManageCategoriesDialog({
  open,
  onOpenChange,
  positionType,
  onCategoriesChanged,
  onCategoryDeleted,
}: ManageCategoriesDialogProps) {
  const [categories, setCategories] = useState<UserPositionCategoryListItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<UserPositionCategoryListItem | null>(null);
  const [deletingCategory, setDeletingCategory] =
    useState<UserPositionCategoryListItem | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchUserPositionCategoriesWithUsage({ positionType });
      setCategories(data);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load custom categories.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [positionType]);

  async function handleCategoriesChanged() {
    await loadCategories();
    await onCategoriesChanged?.();
  }

  async function handleCategoryDeleted(categoryId: string) {
    onCategoryDeleted?.(categoryId);
    await handleCategoriesChanged();
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setLoadError(null);
      setEditingCategory(null);
      setDeletingCategory(null);
    }
  }

  function handleDialogOpenAutoFocus(event: Event) {
    event.preventDefault();
    void loadCategories();
  }

  const positionTypeLabel = positionType === "asset" ? "assets" : "liabilities";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent onOpenAutoFocus={handleDialogOpenAutoFocus}>
          <DialogHeader>
            <DialogTitle>Manage custom categories</DialogTitle>
            <DialogDescription>
              Rename or delete your custom {positionTypeLabel} categories.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex min-h-0 flex-1 flex-col gap-4">
            {isLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
                <Spinner />
                Loading categories...
              </div>
            ) : loadError ? (
              <div className="space-y-3 py-4 text-center">
                <p className="text-destructive text-sm">{loadError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadCategories()}
                >
                  Try again
                </Button>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                You have not created any custom categories yet.
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {categories.map((category) => (
                  <li
                    key={category.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {category.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatPositionCount(category.position_count)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Rename ${category.name}`}
                        onClick={() => setEditingCategory(category)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${category.name}`}
                        onClick={() => setDeletingCategory(category)}
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
              onClick={() => setCreateDialogOpen(true)}
            >
              <PlusIcon className="size-4" />
              Add category
            </Button>
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateCategoryDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        positionType={positionType}
        onCreated={handleCategoriesChanged}
      />

      <EditCategoryDialog
        key={editingCategory?.id ?? "closed"}
        open={Boolean(editingCategory)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditingCategory(null);
          }
        }}
        category={editingCategory}
        positionType={positionType}
        onUpdated={handleCategoriesChanged}
      />

      <DeleteCategoryDialog
        category={deletingCategory}
        open={Boolean(deletingCategory)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeletingCategory(null);
          }
        }}
        positionType={positionType}
        onDeleted={handleCategoryDeleted}
      />
    </>
  );
}
