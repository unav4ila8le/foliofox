"use client";

import { type SyntheticEvent, useState } from "react";
import { Check, ChevronsUpDown, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

import { cn } from "@/lib/utils";
import { usePositionCategories } from "@/hooks/use-position-categories";
import { createUserPositionCategory } from "@/server/position-categories/fetch";

import type { PositionCategoryListItem } from "@/server/position-categories/fetch";

// Props interface for react-hook-form integration
interface CategorySelectorProps {
  field: {
    value: string | undefined;
    onChange: (value: string) => void;
  };
  userCategoryId?: string | null;
  onUserCategoryChange?: (value: string | null) => void;
  id?: string;
  isInvalid?: boolean;
  positionType?: "asset" | "liability";
  allowCustomCategories?: boolean;
  disabled?: boolean;
  className?: string;
  popoverWidth?: string;
}

export function PositionCategorySelector({
  field,
  userCategoryId = null,
  onUserCategoryChange,
  id,
  isInvalid = false,
  positionType = "asset",
  allowCustomCategories = false,
  disabled = false,
  className,
  popoverWidth = "w-(--radix-popover-trigger-width)",
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false);

  const { categories, isLoading, refreshCategories } = usePositionCategories({
    positionType,
    includeCustomCategories: allowCustomCategories,
  });

  // Prefer the user category label when a custom category is selected; the
  // underlying Foliofox category remains "other" and should stay invisible.
  const selectedCategory = categories.find((category) => {
    if (userCategoryId) {
      return category.user_category_id === userCategoryId;
    }

    return category.source === "system" && category.category_id === field.value;
  });
  const categoryName = selectedCategory
    ? selectedCategory.name
    : field.value || "";

  return (
    // This selector is commonly rendered inside asset dialogs. Radix Dialog
    // scroll locking can block wheel/touch scrolling for portalled popovers
    // unless the nested Popover manages its own modal context.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={isInvalid}
          disabled={disabled}
          className={cn(
            "justify-between font-normal",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            !categoryName && "text-muted-foreground",
            className,
          )}
        >
          {categoryName || "Select category"}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(popoverWidth, "p-0")}>
        <PositionCategoryList
          setOpen={setOpen}
          value={field.value}
          onChange={field.onChange}
          userCategoryId={userCategoryId}
          onUserCategoryChange={onUserCategoryChange}
          categories={categories}
          isLoading={isLoading}
          positionType={positionType}
          allowCustomCategories={allowCustomCategories}
          refreshCategories={refreshCategories}
        />
      </PopoverContent>
    </Popover>
  );
}

interface CategoryListProps {
  setOpen: (open: boolean) => void;
  value: string | undefined;
  onChange: (value: string) => void;
  userCategoryId: string | null;
  onUserCategoryChange?: (value: string | null) => void;
  categories: PositionCategoryListItem[];
  isLoading: boolean;
  positionType: "asset" | "liability";
  allowCustomCategories: boolean;
  refreshCategories: () => Promise<void>;
}

function PositionCategoryList({
  setOpen,
  value,
  onChange,
  userCategoryId,
  onUserCategoryChange,
  categories,
  isLoading,
  positionType,
  allowCustomCategories,
  refreshCategories,
}: CategoryListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const systemCategories = categories.filter(
    (category) => category.source === "system",
  );
  const customCategories = categories.filter(
    (category) => category.source === "custom",
  );

  function selectCategory(category: PositionCategoryListItem) {
    // The server normalizes both system and custom rows into persistence fields:
    // system rows keep their own category_id, custom rows use category_id
    // "other" plus a user_category_id for the visible label.
    onChange(category.category_id);
    onUserCategoryChange?.(category.user_category_id);
    setOpen(false);
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

      await refreshCategories();
      // Creating a custom category immediately selects it. The hidden system
      // category remains "other" so DB constraints and system-only analytics
      // still have a canonical category to work with.
      onChange("other");
      onUserCategoryChange?.(result.category.id);
      setNewCategoryName("");
      setCreateDialogOpen(false);
      setOpen(false);
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
    <>
      <Command>
        <CommandInput placeholder="Search category..." className="h-9" />
        <CommandList>
          <CommandEmpty>
            {isLoading ? "Loading categories..." : "No categories found."}
          </CommandEmpty>
          <CommandGroup heading="System Categories">
            {systemCategories.map((category) => (
              <CommandItem
                key={category.id}
                onSelect={() => selectCategory(category)}
                value={category.name}
              >
                {category.name}
                <Check
                  className={cn(
                    "ml-auto",
                    !userCategoryId && value === category.category_id
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
          {allowCustomCategories && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Custom Categories">
                {customCategories.map((category) => (
                  <CommandItem
                    key={category.id}
                    onSelect={() => selectCategory(category)}
                    value={category.name}
                  >
                    {category.name}
                    <Check
                      className={cn(
                        "ml-auto",
                        userCategoryId === category.user_category_id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
                <CommandItem
                  onSelect={() => {
                    setCreateDialogOpen(true);
                  }}
                  value="add-new-custom-category"
                >
                  <PlusIcon />
                  Add new custom category
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(nextOpen) => {
          setCreateDialogOpen(nextOpen);
          if (!nextOpen) {
            setOpen(false);
          }
        }}
      >
        <DialogContent>
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
                onClick={() => {
                  setCreateDialogOpen(false);
                  setOpen(false);
                }}
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
    </>
  );
}
