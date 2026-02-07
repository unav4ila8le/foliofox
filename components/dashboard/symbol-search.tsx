"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "use-debounce";
import { Search, XIcon } from "lucide-react";

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
import { Spinner } from "@/components/ui/spinner";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { searchYahooFinanceSymbols } from "@/server/symbols/search";

import type { SymbolSearchResult } from "@/types/global.types";

// Props interface for react-hook-form integration
interface SymbolSearchProps {
  field: {
    value: string | undefined;
    onChange: (value: string) => void;
  };
  id?: string;
  isInvalid?: boolean;
  fieldName?: string;
  clearErrors?: (name: string) => void;
  onSymbolSelect?: (symbolId: string) => void;
  className?: string;
  popoverWidth?: string;
}

export function SymbolSearch({
  field,
  id,
  isInvalid = false,
  fieldName,
  clearErrors,
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

  // Find the selected equity
  const selectedSymbol = results.find((symbol) => symbol.id === field.value);
  const symbolName = selectedSymbol
    ? selectedSymbol.id
    : field.value || "Search symbol";
  const hasSelectedValue = Boolean(field.value);

  useEffect(() => {
    if (!debouncedQuery) {
      // Show popular symbols when no search query
      setResults([
        {
          id: "AAPL",
          nameDisp: "Apple Inc.",
          exchange: "NMS",
          typeDisp: "Equity",
        },
        {
          id: "MSFT",
          nameDisp: "Microsoft Corporation",
          exchange: "NMS",
          typeDisp: "Equity",
        },
        {
          id: "TSLA",
          nameDisp: "Tesla Inc.",
          exchange: "NMS",
          typeDisp: "Equity",
        },
        {
          id: "VWCE.DE",
          nameDisp: "Vanguard FTSE All-World UCITS ETF USD Accumulation",
          exchange: "GER",
          typeDisp: "ETF",
        },
        {
          id: "BTC-USD",
          nameDisp: "Bitcoin USD",
          exchange: "CCC",
          typeDisp: "Cryptocurrency",
        },
      ]);
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
    onChange: (v: string) => {
      if (clearErrors && fieldName) clearErrors(fieldName);
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
              "group relative justify-between font-normal",
              "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
              !hasSelectedValue && "text-muted-foreground",
              className,
            )}
          >
            {symbolName}
            {hasSelectedValue && (
              <div
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 hidden h-7 w-7 -translate-y-1/2 group-hover:flex"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (clearErrors && fieldName) clearErrors(fieldName);
                  field.onChange("");
                  setSearchQuery("");
                }}
              >
                <XIcon />
                <span className="sr-only">Clear</span>
              </div>
            )}
            {isLoadingQuote ? (
              <Spinner />
            ) : (
              <Search
                className={cn(
                  "text-muted-foreground",
                  hasSelectedValue && "group-hover:hidden",
                )}
              />
            )}
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
            "group relative justify-between font-normal",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            !hasSelectedValue && "text-muted-foreground",
            className,
          )}
        >
          {symbolName}
          {hasSelectedValue && (
            <div
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 hidden h-7 w-7 -translate-y-1/2 items-center justify-center group-hover:flex"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (clearErrors && fieldName) clearErrors(fieldName);
                field.onChange("");
                setSearchQuery("");
              }}
            >
              <XIcon />
              <span className="sr-only">Clear</span>
            </div>
          )}
          {isLoadingQuote ? (
            <Spinner />
          ) : (
            <Search
              className={cn(
                "text-muted-foreground",
                hasSelectedValue && "group-hover:hidden",
              )}
            />
          )}
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

      // Call the async onSymbolSelect if provided
      if (onSymbolSelect) {
        await onSymbolSelect(symbol.id);
      }

      onChange(symbol.id);
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
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
