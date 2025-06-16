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
import { searchSymbols } from "@/server/symbols/search";

import type { Symbol } from "@/types/global.types";

// Props interface for react-hook-form integration
interface SymbolSearchProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
  id?: string;
  quoteTypes?: string[];
}

export function SymbolSearch({
  field,
  id,
  quoteTypes = [],
}: SymbolSearchProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Symbol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const isMobile = useIsMobile();

  // Find the selected equity
  const selectedSymbol = results.find((symbol) => symbol.id === field.value);
  const symbolName = selectedSymbol
    ? `${selectedSymbol.id} - ${selectedSymbol.name}`
    : field.value;

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    (async () => {
      try {
        const result = await searchSymbols({
          query: debouncedQuery,
          limit: 10,
          quoteTypes: quoteTypes,
        });
        if (result.success && result.data) {
          setResults(result.data);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error("Error searching symbols:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [debouncedQuery, quoteTypes]);

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
              !symbolName && "text-muted-foreground",
            )}
          >
            {symbolName || "Search symbol"}
            <Search className="text-muted-foreground" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Equity</DrawerTitle>
          </DrawerHeader>
          <SymbolList
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
            !symbolName && "text-muted-foreground",
          )}
        >
          {symbolName || "Search symbol"}
          <Search className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <SymbolList
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

interface SymbolListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  results: Symbol[];
  isLoading: boolean;
  setSearchQuery: (query: string) => void;
}

function SymbolList({
  setOpen,
  value,
  onChange,
  results,
  isLoading,
  setSearchQuery,
}: SymbolListProps) {
  return (
    <Command>
      <CommandInput
        placeholder="Search symbol..."
        className="h-9"
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Searching..." : "No symbols found."}
        </CommandEmpty>
        <CommandGroup>
          {results.map((symbol) => (
            <CommandItem
              key={symbol.id}
              onSelect={() => {
                onChange(symbol.id);
                setOpen(false);
              }}
              value={symbol.id}
            >
              {symbol.id} - {symbol.name}
              <Check
                className={cn(
                  "ml-auto",
                  value === symbol.id ? "opacity-100" : "opacity-0",
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
