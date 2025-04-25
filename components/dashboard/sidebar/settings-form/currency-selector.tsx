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

// Currency options matching the form schema
const currencies = [
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
  { value: "CHF", label: "CHF" },
];

// Props interface for react-hook-form integration
interface CurrencySelectorProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
}

export function CurrencySelector({ field }: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between"
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
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between"
        >
          {field.value}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <CurrencyList
          setOpen={setOpen}
          value={field.value}
          onChange={field.onChange}
        />
      </PopoverContent>
    </Popover>
  );
}

interface CurrencyListProps {
  setOpen: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
}

function CurrencyList({ setOpen, value, onChange }: CurrencyListProps) {
  return (
    <Command>
      <CommandInput placeholder="Search currency..." className="h-9" />
      <CommandList>
        <CommandEmpty>No currency found.</CommandEmpty>
        <CommandGroup>
          {currencies.map((currency) => (
            <CommandItem
              key={currency.value}
              onSelect={() => {
                onChange(currency.value);
                setOpen(false);
              }}
              value={currency.value}
            >
              {currency.label}
              <Check
                className={cn(
                  "ml-auto",
                  value === currency.value ? "opacity-100" : "opacity-0",
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
