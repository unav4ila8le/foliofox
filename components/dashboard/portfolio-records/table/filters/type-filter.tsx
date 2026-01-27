"use client";

import { useMemo, useState } from "react";
import { PlusCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import { type PortfolioRecordType } from "@/lib/portfolio-records/filters";
import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";

interface PortfolioRecordTypeFilterProps {
  selectedTypes: PortfolioRecordType[];
  onSelectionChange: (types: PortfolioRecordType[]) => void;
}

export function PortfolioRecordTypeFilter({
  selectedTypes,
  onSelectionChange,
}: PortfolioRecordTypeFilterProps) {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedTypes), [selectedTypes]);

  const options = PORTFOLIO_RECORD_TYPES;

  const toggleType = (type: PortfolioRecordType) => {
    const next = new Set(selectedSet);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onSelectionChange(Array.from(next));
  };

  const clearTypes = () => {
    onSelectionChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-dashed px-2">
          {selectedTypes.length > 0 ? (
            <span
              className="text-muted-foreground hover:text-foreground"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearTypes();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <XCircle />
            </span>
          ) : (
            <PlusCircle />
          )}
          Type
          {selectedTypes.map((type) => (
            <Badge key={type} variant="secondary" className="capitalize">
              {type}
            </Badge>
          ))}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-0">
        <Command>
          <CommandInput placeholder="Search type..." className="h-9" />
          <CommandList>
            <CommandEmpty>No type found.</CommandEmpty>
            <CommandGroup>
              {options.map((type) => {
                const isSelected = selectedSet.has(type);
                return (
                  <CommandItem
                    key={type}
                    value={type}
                    onSelect={() => toggleType(type)}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      checked={isSelected}
                      className="[&_svg]:text-primary-foreground!"
                    />
                    <span className="capitalize">{type}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedTypes.length > 0 && (
              <>
                <CommandSeparator />
                <CommandItem
                  onSelect={clearTypes}
                  className="justify-center text-sm"
                >
                  Clear filters
                </CommandItem>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
