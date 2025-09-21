"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "use-debounce";
import { useFormContext } from "react-hook-form";
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
import { useFormField } from "@/components/ui/form";
import { searchYahooFinanceSymbols } from "@/server/symbols/search";

import type { SymbolSearchResult } from "@/types/global.types";

// Props interface for react-hook-form integration
interface SymbolSearchProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
  id?: string;
  onSymbolSelect?: (symbolId: string) => void;
  className?: string;
  popoverWidth?: string;
}

export function SymbolSearch({
  field,
  id,
  onSymbolSelect,
  className,
  popoverWidth = "w-(--radix-popover-trigger-width)",
}: SymbolSearchProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const isMobile = useIsMobile();
  const { error, name } = useFormField();
  const isInvalid = Boolean(error);
  const { clearErrors } = useFormContext();

  // Find the selected equity
  const selectedSymbol = results.find((symbol) => symbol.id === field.value);
  const symbolName = selectedSymbol
    ? selectedSymbol.id
    : field.value || "Search symbol";
  const hasSelectedValue = Boolean(field.value);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    (async () => {
      try {
        const result = await searchYahooFinanceSymbols({
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
    onChange: (v: string) => {
      clearErrors(name);
      field.onChange(v);
    },
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
            aria-invalid={isInvalid}
            className={cn(
              "justify-between font-normal",
              "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
              !hasSelectedValue && "text-muted-foreground",
              className,
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
          aria-invalid={isInvalid}
          className={cn(
            "justify-between font-normal",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            !hasSelectedValue && "text-muted-foreground",
            className,
          )}
        >
          {symbolName}
          <Search className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(popoverWidth, "p-0")}>
        <SymbolList {...symbolListProps} />
      </PopoverContent>
    </Popover>
  );
}

interface SymbolListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onSymbolSelect?: (symbolId: string) => void;
  results: SymbolSearchResult[];
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
  const handleSymbolSelect = async (symbol: SymbolSearchResult) => {
    try {
      setIsLoadingQuote(true);
      onChange(symbol.id);

      // Call the async onSymbolSelect if provided
      if (onSymbolSelect) {
        await onSymbolSelect(symbol.id);
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
              value={[symbol.id, symbol.nameDisp ?? "", symbol.exchange ?? ""]
                .filter(Boolean)
                .join(" ")
                .replace(/\s+/g, " ")}
              keywords={[
                symbol.id,
                symbol.nameDisp ?? "",
                symbol.exchange ?? "",
              ].filter(Boolean)}
              disabled={isLoadingQuote}
              className="flex flex-row justify-between gap-4"
            >
              <div className="flex flex-col">
                <span>{symbol.id}</span>
                <span className="text-muted-foreground text-xs">
                  {symbol.nameDisp}
                </span>
              </div>
              <div className="flex flex-row gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs">
                    {symbol.exchange}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {symbol.typeDisp}
                  </span>
                </div>
                {isLoadingQuote && value === symbol.id ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Check
                    className={cn(
                      "size-4",
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
