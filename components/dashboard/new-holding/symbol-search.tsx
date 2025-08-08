"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "use-debounce";
import { Check, LoaderCircle, Search } from "lucide-react";

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
  onSymbolSelect?: (symbol: Symbol) => void;
}

export function SymbolSearch({ field, id, onSymbolSelect }: SymbolSearchProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Symbol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const isMobile = useIsMobile();

  // Find the selected equity
  const selectedSymbol = results.find((symbol) => symbol.id === field.value);
  const symbolName = selectedSymbol
    ? `${selectedSymbol.id} - ${selectedSymbol.long_name}`
    : field.value || "Search symbol";
  const hasSelectedValue = Boolean(field.value && selectedSymbol);

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
  }, [debouncedQuery]);

  // SymbolList props
  const symbolListProps = {
    setOpen,
    value: field.value,
    onChange: field.onChange,
    onSymbolSelect,
    results,
    isLoading,
    isLoadingQuote,
    setIsLoadingQuote,
    setSearchQuery,
  };

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
              !hasSelectedValue && "text-muted-foreground",
            )}
          >
            {symbolName}
            <Search className="text-muted-foreground" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Equity</DrawerTitle>
          </DrawerHeader>
          <SymbolList {...symbolListProps} />
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
            !hasSelectedValue && "text-muted-foreground",
          )}
        >
          {symbolName}
          <Search className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <SymbolList {...symbolListProps} />
      </PopoverContent>
    </Popover>
  );
}

interface SymbolListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onSymbolSelect?: (symbol: Symbol) => void;
  results: Symbol[];
  isLoading: boolean;
  isLoadingQuote: boolean;
  setIsLoadingQuote: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
}

function SymbolList({
  setOpen,
  value,
  onChange,
  onSymbolSelect,
  results,
  isLoading,
  isLoadingQuote,
  setIsLoadingQuote,
  setSearchQuery,
}: SymbolListProps) {
  // Handle symbol selection with loading state
  const handleSymbolSelect = async (symbol: Symbol) => {
    try {
      setIsLoadingQuote(true);
      onChange(symbol.id);

      // Call the async onSymbolSelect if provided
      if (onSymbolSelect) {
        await onSymbolSelect(symbol);
      }

      setOpen(false);
    } catch (error) {
      console.error("Error selecting symbol:", error);
      // Keep the dialog open on error so user can try again
    } finally {
      setIsLoadingQuote(false);
    }
  };

  return (
    <Command>
      <CommandInput
        placeholder="Search symbol..."
        className="h-9"
        onValueChange={setSearchQuery}
        disabled={isLoadingQuote}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Searching..." : "No symbols found."}
        </CommandEmpty>
        <CommandGroup>
          {results.map((symbol) => (
            <CommandItem
              key={symbol.id}
              onSelect={() => handleSymbolSelect(symbol)}
              value={[
                symbol.id,
                symbol.short_name ?? "",
                symbol.long_name ?? "",
                symbol.exchange ?? "",
              ]
                .filter(Boolean)
                .join(" ")
                .replace(/\s+/g, " ")}
              keywords={[
                symbol.id,
                symbol.short_name ?? "",
                symbol.long_name ?? "",
                symbol.exchange ?? "",
              ].filter(Boolean)}
              disabled={isLoadingQuote}
              className="flex flex-row justify-between gap-4"
            >
              <div className="flex flex-col">
                <span>{symbol.id}</span>
                <span className="text-muted-foreground text-xs">
                  {symbol.short_name || symbol.long_name}
                </span>
              </div>
              <div className="flex flex-row gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs">
                    {symbol.exchange}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {symbol.quote_type}
                  </span>
                </div>
                {isLoadingQuote && value === symbol.id ? (
                  <LoaderCircle className="ml-auto animate-spin" />
                ) : (
                  <Check
                    className={cn(
                      "ml-auto",
                      value === symbol.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
