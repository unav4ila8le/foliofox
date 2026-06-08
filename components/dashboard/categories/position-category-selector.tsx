"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, PlusIcon } from "lucide-react";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { CreateCategoryDialog } from "@/components/dashboard/categories/create-category-dialog";
import { cn } from "@/lib/utils";
import { usePositionCategories } from "@/hooks/use-position-categories";

import type { PositionCategoryListItem } from "@/server/position-categories/fetch";

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

  async function handleCategoryCreated(category: { id: string; name: string }) {
    await refreshCategories();
    // Creating a custom category immediately selects it. The hidden system
    // category remains "other" so DB constraints and system-only analytics
    // still have a canonical category to work with.
    onChange("other");
    onUserCategoryChange?.(category.id);
    setOpen(false);
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

      <CreateCategoryDialog
        open={createDialogOpen}
        onOpenChange={(nextOpen) => {
          setCreateDialogOpen(nextOpen);
          if (!nextOpen) {
            setOpen(false);
          }
        }}
        positionType={positionType}
        onCreated={handleCategoryCreated}
      />
    </>
  );
}
