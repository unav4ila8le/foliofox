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

import { fetchHoldings } from "@/server/holdings/fetch";

import type { TransformedHolding } from "@/types/global.types";

// Props interface for react-hook-form integration
interface HoldingSelectorProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
  onHoldingSelect?: (holding: TransformedHolding | null) => void;
  id?: string;
  preselectedHolding?: TransformedHolding | null;
}

export function HoldingSelector({
  field,
  onHoldingSelect,
  id,
  preselectedHolding,
}: HoldingSelectorProps) {
  const [open, setOpen] = useState(false);
  const [holdings, setHoldings] = useState<TransformedHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();

  // Load holdings when the selector opens
  const getHoldings = async () => {
    try {
      const data = await fetchHoldings({
        asOfDate: new Date(),
      });
      setHoldings(data);
    } catch (error) {
      console.error("Error loading holdings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Find the selected holding name
  // If a preselected holding is provided, use it if it matches the field value
  const selectedHolding =
    preselectedHolding && preselectedHolding.id === field.value
      ? preselectedHolding
      : holdings.find((h) => h.id === field.value);
  const holdingName = selectedHolding ? selectedHolding.name : field.value;

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
              !holdingName && "text-muted-foreground",
            )}
            onClick={() => {
              if (open) return;
              setIsLoading(true);
              getHoldings();
            }}
          >
            {holdingName || "Select holding"}
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Holding</DrawerTitle>
          </DrawerHeader>
          <HoldingList
            setOpen={setOpen}
            value={field.value}
            onChange={field.onChange}
            onHoldingSelect={onHoldingSelect}
            holdings={holdings}
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
            !holdingName && "text-muted-foreground",
          )}
          onClick={() => {
            if (open) return;
            setIsLoading(true);
            getHoldings();
          }}
        >
          {holdingName || "Select holding"}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <HoldingList
          setOpen={setOpen}
          value={field.value}
          onChange={field.onChange}
          onHoldingSelect={onHoldingSelect}
          holdings={holdings}
          isLoading={isLoading}
        />
      </PopoverContent>
    </Popover>
  );
}

interface HoldingListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onHoldingSelect?: (holding: TransformedHolding | null) => void;
  holdings: TransformedHolding[];
  isLoading: boolean;
}

function HoldingList({
  setOpen,
  value,
  onChange,
  onHoldingSelect,
  holdings,
  isLoading,
}: HoldingListProps) {
  // Group by category (sorted by display_order), and holdings by name
  const grouped = [...holdings]
    .sort(
      (a, b) =>
        a.asset_categories.display_order - b.asset_categories.display_order,
    )
    .reduce<Record<string, TransformedHolding[]>>((acc, h) => {
      const key = h.asset_categories.name;
      (acc[key] ||= []).push(h);
      return acc;
    }, {});

  Object.values(grouped).forEach((arr) =>
    arr.sort((a, b) => a.name.localeCompare(b.name)),
  );

  return (
    <Command>
      <CommandInput placeholder="Search holding..." className="h-9" />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Loading holdings..." : "No holdings found."}
        </CommandEmpty>
        {Object.entries(grouped).map(([categoryName, items]) => (
          <Fragment key={categoryName}>
            <CommandGroup heading={categoryName}>
              {items.map((holding) => (
                <CommandItem
                  key={holding.id}
                  onSelect={() => {
                    onChange(holding.id);
                    onHoldingSelect?.(holding);
                    setOpen(false);
                  }}
                  value={holding.name}
                >
                  {holding.name}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === holding.id ? "opacity-100" : "opacity-0",
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
