"use client";

import { Fragment, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

import { fetchPositions } from "@/server/positions/fetch";

import type { TransformedPosition } from "@/types/global.types";

// Props interface for react-hook-form integration
interface PositionSelectorProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
  onPositionSelect?: (position: TransformedPosition | null) => void;
  id?: string;
  preselectedPosition?: TransformedPosition | null;
}

export function PositionSelector({
  field,
  onPositionSelect,
  id,
  preselectedPosition,
}: PositionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [positions, setPositions] = useState<TransformedPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();

  // Load holdings when the selector opens
  const getPositions = async () => {
    try {
      const data = await fetchPositions({
        asOfDate: new Date(),
      });
      setPositions(data);
    } catch (error) {
      console.error("Error loading holdings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Find the selected holding name
  // If a preselected holding is provided, use it if it matches the field value
  const selectedPosition =
    preselectedPosition && preselectedPosition.id === field.value
      ? preselectedPosition
      : positions.find((p) => p.id === field.value);
  const positionName = selectedPosition ? selectedPosition.name : field.value;

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
              !positionName && "text-muted-foreground",
            )}
            onClick={() => {
              if (open) return;
              setIsLoading(true);
              getPositions();
            }}
          >
            {positionName || "Select position"}
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Position</DrawerTitle>
          </DrawerHeader>
          <PositionList
            setOpen={setOpen}
            value={field.value}
            onChange={field.onChange}
            onPositionSelect={onPositionSelect}
            positions={positions}
            isLoading={isLoading}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal",
            !positionName && "text-muted-foreground",
          )}
          onClick={() => {
            if (open) return;
            setIsLoading(true);
            getPositions();
          }}
        >
          {positionName || "Select position"}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <PositionList
          setOpen={setOpen}
          value={field.value}
          onChange={field.onChange}
          onPositionSelect={onPositionSelect}
          positions={positions}
          isLoading={isLoading}
        />
      </PopoverContent>
    </Popover>
  );
}

interface PositionListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onPositionSelect?: (position: TransformedPosition | null) => void;
  positions: TransformedPosition[];
  isLoading: boolean;
}

function PositionList({
  setOpen,
  value,
  onChange,
  onPositionSelect,
  positions,
  isLoading,
}: PositionListProps) {
  // Group by category name (server already orders by category display_order)
  const grouped = [...positions].reduce<Record<string, TransformedPosition[]>>(
    (acc, p) => {
      const key = p.category_name || "Other";
      (acc[key] ||= []).push(p);
      return acc;
    },
    {},
  );

  Object.values(grouped).forEach((arr) =>
    arr.sort((a, b) => a.name.localeCompare(b.name)),
  );

  return (
    <Command>
      <CommandInput placeholder="Search position..." className="h-9" />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Loading positions..." : "No positions found."}
        </CommandEmpty>
        {Object.entries(grouped).map(([categoryName, items]) => (
          <Fragment key={categoryName}>
            <CommandGroup heading={categoryName}>
              {items.map((position) => (
                <CommandItem
                  key={position.id}
                  onSelect={() => {
                    onChange(position.id);
                    onPositionSelect?.(position);
                    setOpen(false);
                  }}
                  value={position.name}
                >
                  {position.name}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === position.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator className="last:hidden" />
          </Fragment>
        ))}
      </CommandList>
    </Command>
  );
}
