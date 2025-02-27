"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

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

// Data placeholder
const currencies = [
  {
    value: "usd",
    label: "USD",
  },
  {
    value: "eur",
    label: "EUR",
  },
  {
    value: "hkd",
    label: "HKD",
  },
];

export function CurrencySelector() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" role="combobox" aria-expanded={open}>
          {value
            ? currencies.find((currency) => currency.value === value)?.label
            : "Select currency..."}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search currency..." className="h-9" />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {currencies.map((currency) => (
                <CommandItem
                  key={currency.value}
                  onSelect={() => {
                    setValue(currency.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
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
      </PopoverContent>
    </Popover>
  );
}
