"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";

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

import { cn } from "@/lib/utils";
import { useCurrencies } from "@/hooks/use-currencies";

import type { Currency } from "@/types/global.types";

// Props interface for react-hook-form integration
interface CurrencySelectorProps {
  field: {
    value: string | undefined;
    onChange: (value: string) => void;
  };
  id?: string;
  isInvalid?: boolean;
  disabled?: boolean;
  className?: string;
  popoverAlign?: "start" | "center" | "end";
  popoverWidth?: string;
  showCurrencyName?: boolean;
}

export function CurrencySelector({
  field,
  id,
  isInvalid = false,
  disabled,
  className,
  popoverAlign = "start",
  popoverWidth = "w-(--radix-popover-trigger-width)",
  showCurrencyName = true,
}: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);

  // Get currencies
  const { currencies, isLoading } = useCurrencies();
  const selectedCurrency = currencies.find(
    (currency) => currency.alphabetic_code === field.value,
  );
  const selectedCurrencyLabel = selectedCurrency
    ? showCurrencyName
      ? `${selectedCurrency.alphabetic_code} - ${selectedCurrency.name}`
      : selectedCurrency.alphabetic_code
    : field.value || "Select currency";

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          aria-invalid={isInvalid}
          className={cn(
            "justify-between font-normal",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            !field.value && "text-muted-foreground",
            className,
          )}
        >
          {selectedCurrencyLabel}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={popoverAlign} className={cn(popoverWidth, "p-0")}>
        <CurrencyList
          setOpen={setOpen}
          value={field.value}
          onChange={field.onChange}
          currencies={currencies}
          isLoading={isLoading}
        />
      </PopoverContent>
    </Popover>
  );
}

interface CurrencyListProps {
  setOpen: (open: boolean) => void;
  value: string | undefined;
  onChange: (value: string) => void;
  currencies: Currency[];
  isLoading: boolean;
}

function CurrencyList({
  setOpen,
  value,
  onChange,
  currencies,
  isLoading,
}: CurrencyListProps) {
  return (
    <Command>
      <CommandInput placeholder="Search currency..." className="h-9" />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Loading currencies..." : "No currency found."}
        </CommandEmpty>
        <CommandGroup>
          {currencies.map((currency) => (
            <CommandItem
              key={currency.alphabetic_code}
              data-checked={value === currency.alphabetic_code}
              onSelect={() => {
                onChange(currency.alphabetic_code);
                setOpen(false);
              }}
              value={`${currency.alphabetic_code} - ${currency.name}`}
            >
              {currency.alphabetic_code} - {currency.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
