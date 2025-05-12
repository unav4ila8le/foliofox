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
import { useAssetCategories } from "@/hooks/use-asset-categories";

import type { AssetCategory } from "@/types/global.types";

// Props interface for react-hook-form integration
interface CategorySelectorProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
  id?: string;
}

export function AssetCategorySelector({ field, id }: CategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  // Get asset categories
  const { categories, loading } = useAssetCategories();

  // Find the selected category name
  const selectedCategory = categories.find((cat) => cat.code === field.value);
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
            className={cn(
              "justify-between font-normal",
              !categoryName && "text-muted-foreground",
            )}
          >
            {categoryName || "Select category"}
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Asset category</DrawerTitle>
          </DrawerHeader>
          <AssetCategoryList
            setOpen={setOpen}
            value={field.value}
            onChange={field.onChange}
            categories={categories}
            loading={loading}
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
          className={cn(
            "justify-between font-normal",
            !categoryName && "text-muted-foreground",
          )}
        >
          {categoryName || "Select category"}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <AssetCategoryList
          setOpen={setOpen}
          value={field.value}
          onChange={field.onChange}
          categories={categories}
          loading={loading}
        />
      </PopoverContent>
    </Popover>
  );
}

interface CategoryListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  categories: AssetCategory[];
  loading: boolean;
}

function AssetCategoryList({
  setOpen,
  value,
  onChange,
  categories,
  loading,
}: CategoryListProps) {
  return (
    <Command>
      <CommandInput placeholder="Search category..." className="h-9" />
      <CommandList>
        <CommandEmpty>
          {loading ? "Loading categories..." : "No categories found."}
        </CommandEmpty>
        <CommandGroup>
          {categories.map((category) => (
            <CommandItem
              key={category.code}
              onSelect={() => {
                onChange(category.code);
                setOpen(false);
              }}
              value={category.code}
            >
              {category.name}
              <Check
                className={cn(
                  "ml-auto",
                  value === category.code ? "opacity-100" : "opacity-0",
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
