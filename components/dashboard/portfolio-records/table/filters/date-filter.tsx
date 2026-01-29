"use client";

import { CalendarIcon, XCircle } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/date/date-format";
import { cn } from "@/lib/utils";

interface PortfolioRecordDateFilterProps {
  value?: DateRange;
  onChange: (range?: DateRange) => void;
  className?: string;
}

export function PortfolioRecordDateFilter({
  value,
  onChange,
  className,
}: PortfolioRecordDateFilterProps) {
  const locale = useLocale();
  const label = (() => {
    if (!value?.from) return "Date";
    if (!value.to) {
      return formatDate(value.from, { locale });
    }
    return `${formatDate(value.from, { locale })} - ${formatDate(value.to, {
      locale,
    })}`;
  })();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("border-dashed", className)}>
          {value?.from || value?.to ? (
            <span
              className="text-muted-foreground hover:text-foreground"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange(undefined);
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <XCircle />
            </span>
          ) : (
            <CalendarIcon />
          )}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          captionLayout="dropdown"
          defaultMonth={value?.from}
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
