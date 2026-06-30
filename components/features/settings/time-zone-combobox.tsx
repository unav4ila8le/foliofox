"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { AUTO_TIME_ZONE_VALUE } from "@/lib/date/time-zone";
import { cn } from "@/lib/utils";

type TimeZoneGroup = {
  heading: string;
  values: string[];
};

interface TimeZoneComboboxProps {
  field: {
    value: string | undefined;
    onChange: (value: string) => void;
  };
  options: string[];
  id?: string;
  isInvalid?: boolean;
  className?: string;
}

// For display purposes, replace underscores with spaces
function formatTimeZoneLabel(timeZone: string): string {
  return timeZone.replace(/_/g, " ");
}

function buildTimeZoneGroups(options: string[]): TimeZoneGroup[] {
  // 1) Group by region prefix to keep the long list scannable for users.
  const groupedByRegion = new Map<string, string[]>();

  options.forEach((timeZone) => {
    const [region] = timeZone.split("/");
    const key = region || "Other";
    const currentGroup = groupedByRegion.get(key) ?? [];
    currentGroup.push(timeZone);
    groupedByRegion.set(key, currentGroup);
  });

  // 2) Sort group headings and each group's values for stable UI order.
  return Array.from(groupedByRegion.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([heading, values]) => ({
      heading,
      values: values.sort((left, right) => left.localeCompare(right)),
    }));
}

export function TimeZoneCombobox({
  field,
  options,
  id,
  isInvalid = false,
  className,
}: TimeZoneComboboxProps) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => buildTimeZoneGroups(options), [options]);
  const selectedLabel =
    !field.value || field.value === AUTO_TIME_ZONE_VALUE ? "Auto" : field.value;
  const selectedDisplayLabel =
    selectedLabel === "Auto"
      ? selectedLabel
      : formatTimeZoneLabel(selectedLabel);
  const commandValue =
    !field.value || field.value === AUTO_TIME_ZONE_VALUE
      ? AUTO_TIME_ZONE_VALUE
      : field.value;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={isInvalid}
          className={cn(
            "w-full justify-between font-normal",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            className,
          )}
        >
          <span className="truncate">{selectedDisplayLabel}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command value={commandValue}>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>

            <CommandGroup heading="Automatic">
              <CommandItem
                value={AUTO_TIME_ZONE_VALUE}
                data-checked={
                  field.value === AUTO_TIME_ZONE_VALUE || !field.value
                }
                onSelect={() => {
                  field.onChange(AUTO_TIME_ZONE_VALUE);
                  setOpen(false);
                }}
              >
                Auto
              </CommandItem>
            </CommandGroup>

            {groups.length > 0 && <CommandSeparator />}

            {groups.map((group, index) => (
              <div key={group.heading}>
                <CommandGroup heading={group.heading}>
                  {group.values.map((timeZone) => (
                    <CommandItem
                      key={timeZone}
                      value={timeZone}
                      data-checked={field.value === timeZone}
                      onSelect={() => {
                        field.onChange(timeZone);
                        setOpen(false);
                      }}
                    >
                      {formatTimeZoneLabel(timeZone)}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {index < groups.length - 1 && <CommandSeparator />}
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
