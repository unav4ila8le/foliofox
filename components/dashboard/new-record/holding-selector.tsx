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

import { fetchHoldings } from "@/server/holdings/fetch";

import type { Holding } from "@/types/global.types";

// Props interface for react-hook-form integration
interface HoldingSelectorProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
  id?: string;
  preselectedHolding?: Holding | null;
}

export function HoldingSelector({
  field,
  id,
  preselectedHolding,
}: HoldingSelectorProps) {
  const [open, setOpen] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  // Load holdings when the selector opens
  const getHoldings = async () => {
    try {
      const data = await fetchHoldings();
      setHoldings(data);
    } catch (error) {
      console.error("Error loading holdings:", error);
    } finally {
      setLoading(false);
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
              setLoading(true);
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
            holdings={holdings}
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
            !holdingName && "text-muted-foreground",
          )}
          onClick={() => {
            if (open) return;
            setLoading(true);
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
          holdings={holdings}
          loading={loading}
        />
      </PopoverContent>
    </Popover>
  );
}

interface HoldingListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  holdings: Holding[];
  loading: boolean;
}

function HoldingList({
  setOpen,
  value,
  onChange,
  holdings,
  loading,
}: HoldingListProps) {
  return (
    <Command>
      <CommandInput placeholder="Search holding..." className="h-9" />
      <CommandList>
        <CommandEmpty>
          {loading ? "Loading holdings..." : "No holdings found."}
        </CommandEmpty>
        <CommandGroup>
          {holdings.map((holding) => (
            <CommandItem
              key={holding.id}
              onSelect={() => {
                onChange(holding.id);
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
      </CommandList>
    </Command>
  );
}
