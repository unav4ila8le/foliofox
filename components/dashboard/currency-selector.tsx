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
import { useCurrencies } from "@/hooks/client/use-currencies";

import type { Currency } from "@/types/global.types";

// Props interface for react-hook-form integration
interface CurrencySelectorProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
  id?: string;
}

export function CurrencySelector({ field, id }: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  // Get currencies
  const { currencies, isLoading } = useCurrencies();

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
              !field.value && "text-muted-foreground",
            )}
          >
            {field.value}
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Currency</DrawerTitle>
          </DrawerHeader>
          <CurrencyList
            setOpen={setOpen}
            value={field.value}
            onChange={field.onChange}
            currencies={currencies}
            isLoading={isLoading}
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
            !field.value && "text-muted-foreground",
          )}
        >
          {field.value}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
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
  value: string;
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
              onSelect={() => {
                onChange(currency.alphabetic_code);
                setOpen(false);
              }}
              value={currency.alphabetic_code}
            >
              {currency.alphabetic_code} - {currency.name}
              <Check
                className={cn(
                  "ml-auto",
                  value === currency.alphabetic_code
                    ? "opacity-100"
                    : "opacity-0",
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
