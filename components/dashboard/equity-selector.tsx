"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "use-debounce";
import { Check, Search } from "lucide-react";

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
import { searchEquities } from "@/server/equities/search";

import type { Equity } from "@/types/global.types";

// Props interface for react-hook-form integration
interface EquitySelectorProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
  id?: string;
}

export function EquitySelector({ field, id }: EquitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Equity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const isMobile = useIsMobile();

  // Find the selected equity
  const selectedEquity = results.find(
    (equity) => equity.symbol === field.value,
  );
  const equityName = selectedEquity
    ? `${selectedEquity.symbol} - ${selectedEquity.name}`
    : field.value;

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await searchEquities({ query, limit: 10 });
      if (result.success && result.data) {
        setResults(result.data);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Error searching equities:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce the search query
  useEffect(() => {
    if (debouncedQuery) {
      handleSearch(debouncedQuery);
    }
  }, [debouncedQuery]);

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
              !equityName && "text-muted-foreground",
            )}
          >
            {equityName || "Search equity"}
            <Search className="text-muted-foreground" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Equity</DrawerTitle>
          </DrawerHeader>
          <EquityList
            setOpen={setOpen}
            value={field.value}
            onChange={field.onChange}
            results={results}
            isLoading={isLoading}
            setSearchQuery={setSearchQuery}
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
            !equityName && "text-muted-foreground",
          )}
        >
          {equityName || "Search equity"}
          <Search className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <EquityList
          setOpen={setOpen}
          value={field.value}
          onChange={field.onChange}
          results={results}
          isLoading={isLoading}
          setSearchQuery={setSearchQuery}
        />
      </PopoverContent>
    </Popover>
  );
}

interface EquityListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  results: Equity[];
  isLoading: boolean;
  setSearchQuery: (query: string) => void;
}

function EquityList({
  setOpen,
  value,
  onChange,
  results,
  isLoading,
  setSearchQuery,
}: EquityListProps) {
  return (
    <Command>
      <CommandInput
        placeholder="Search equity..."
        className="h-9"
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Searching..." : "No equities found."}
        </CommandEmpty>
        <CommandGroup>
          {results.map((equity) => (
            <CommandItem
              key={equity.symbol}
              onSelect={() => {
                onChange(equity.symbol);
                setOpen(false);
              }}
              value={equity.symbol}
            >
              {equity.symbol} - {equity.name}
              <Check
                className={cn(
                  "ml-auto",
                  value === equity.symbol ? "opacity-100" : "opacity-0",
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
