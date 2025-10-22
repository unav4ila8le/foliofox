"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePositionCategories } from "@/hooks/use-position-categories";
import { useFormField } from "@/components/ui/form";

import type { PositionCategory } from "@/types/global.types";

// Props interface for react-hook-form integration
interface CategorySelectorProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
  id?: string;
  positionType?: "asset" | "liability";
  disabled?: boolean;
  className?: string;
  popoverWidth?: string;
}

export function PositionCategorySelector({
  field,
  id,
  positionType = "asset",
  disabled = false,
  className,
  popoverWidth = "w-(--radix-popover-trigger-width)",
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { error } = useFormField();
  const isInvalid = Boolean(error);

  // Get position categories
  const { categories, isLoading } = usePositionCategories(positionType);

  // Find the selected category name
  const selectedCategory = categories.find((cat) => cat.id === field.value);
  const categoryName = selectedCategory ? selectedCategory.name : field.value;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
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
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Position category</DrawerTitle>
          </DrawerHeader>
          <PositionCategoryList
            setOpen={setOpen}
            value={field.value}
            onChange={field.onChange}
            categories={categories}
            isLoading={isLoading}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          categories={categories}
          isLoading={isLoading}
        />
      </PopoverContent>
    </Popover>
  );
}

interface CategoryListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  categories: PositionCategory[];
  isLoading: boolean;
}

function PositionCategoryList({
  setOpen,
  value,
  onChange,
  categories,
  isLoading,
}: CategoryListProps) {
  return (
    <Command>
      <CommandInput placeholder="Search category..." className="h-9" />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Loading categories..." : "No categories found."}
        </CommandEmpty>
        <CommandGroup>
          {categories.map((category) => (
            <CommandItem
              key={category.id}
              onSelect={() => {
                onChange(category.id);
                setOpen(false);
              }}
              value={category.id}
            >
              {category.name}
              <Check
                className={cn(
                  "ml-auto",
                  value === category.id ? "opacity-100" : "opacity-0",
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
