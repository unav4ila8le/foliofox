"use client";

import { useState } from "react";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef, Row, Table } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getBasisCompatibilityDescription,
  eventHasIncompatibleProjectedSeriesThresholdCondition,
  getProjectedSeriesThresholdConditionLabel,
  isProjectedSeriesThresholdCondition,
} from "@/lib/planning/scenario/projected-series";
import type { ScenarioEvent } from "@/lib/planning/scenario/engine";
import { getScenarioEventDateRange } from "@/lib/planning/scenario/event-dates";
import { formatDate } from "@/lib/date/date-format";
import { formatNumber } from "@/lib/number-format";

// Extended type with id for table
export type ScenarioEventWithId = ScenarioEvent & { id: string };

// Actions cell component to avoid hooks in non-component function
function ActionsCell({
  row,
  table,
}: {
  row: Row<ScenarioEventWithId>;
  table: Table<ScenarioEventWithId>;
}) {
  const [open, setOpen] = useState(false);
  const originalIndex = Number.parseInt(
    String(row.original.id).split("-")[0],
    10,
  );
  const hasValidOriginalIndex =
    Number.isInteger(originalIndex) && originalIndex >= 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            if (hasValidOriginalIndex) {
              table.options.meta?.onEdit?.(row.original, originalIndex);
            }
            setOpen(false);
          }}
        >
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => {
            event.stopPropagation();
            if (hasValidOriginalIndex) {
              table.options.meta?.onDelete?.(originalIndex);
            }
            setOpen(false);
          }}
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getAdditionalConditionsCount(event: ScenarioEvent): number {
  return event.unlockedBy.filter((condition) => condition.tag !== "cashflow")
    .length;
}

function getConditionSummary(input: { event: ScenarioEvent; locale?: string }) {
  const conditionSummaries = input.event.unlockedBy
    .filter((condition) => condition.tag !== "cashflow")
    .map((condition) => {
      if (isProjectedSeriesThresholdCondition(condition)) {
        return `${getProjectedSeriesThresholdConditionLabel(condition.type)} ${formatNumber(
          condition.value.amount,
          {
            locale: input.locale,
            maximumFractionDigits: 2,
          },
        )}`;
      }

      if (condition.type === "event-happened") {
        return `${condition.value.eventName} happened`;
      }

      return `${condition.value.eventName} income >= ${formatNumber(
        condition.value.amount,
        {
          locale: input.locale,
          maximumFractionDigits: 2,
        },
      )}`;
    });

  if (conditionSummaries.length <= 2) {
    return conditionSummaries.join(", ");
  }

  return `${conditionSummaries.slice(0, 2).join(", ")} +${
    conditionSummaries.length - 2
  } more`;
}

export const columns: ColumnDef<ScenarioEventWithId>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <div
          className="hover:text-primary flex cursor-pointer items-center gap-2 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row }) => {
      const name = row.getValue<string>("name");
      return (
        <div className="flex w-40 sm:w-64 lg:w-80">
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <div className="truncate">{name}</div>
            </TooltipTrigger>
            <TooltipContent>{name}</TooltipContent>
          </Tooltip>
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue<"income" | "expense">("type");
      return (
        <Badge variant="outline" className="capitalize">
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => {
      return (
        <div
          className="hover:text-primary flex cursor-pointer items-center gap-2 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Amount
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row, table }) => {
      const locale = table.options.meta?.locale;
      const amount = row.getValue<number>("amount");
      return (
        <div className="tabular-nums">
          {formatNumber(amount, { locale, maximumFractionDigits: 6 })}
        </div>
      );
    },
  },
  {
    id: "startDate",
    header: "Start Date",
    cell: ({ row, table }) => {
      const locale = table.options.meta?.locale;
      const { startDate } = getScenarioEventDateRange(row.original);
      if (!startDate) return <span className="text-muted-foreground">-</span>;
      return formatDate(startDate, { locale });
    },
  },
  {
    id: "recurrence",
    header: "Recurrence",
    cell: ({ row }) => {
      const event = row.original;
      const isRecurring = event.recurrence.type !== "once";

      if (!isRecurring) {
        return <div className="text-muted-foreground">Once</div>;
      }

      return <div className="capitalize">{event.recurrence.type}</div>;
    },
  },
  {
    id: "endDate",
    header: "End Date",
    cell: ({ row, table }) => {
      const locale = table.options.meta?.locale;
      const event = row.original;
      const isRecurring = event.recurrence.type !== "once";

      if (!isRecurring) {
        return <div className="text-muted-foreground">-</div>;
      }

      const { endDate } = getScenarioEventDateRange(event);
      if (!endDate) {
        return <div className="text-muted-foreground">Never</div>;
      }

      return formatDate(endDate, { locale });
    },
  },
  {
    id: "conditions",
    header: "Conditions",
    cell: ({ row, table }) => {
      const count = getAdditionalConditionsCount(row.original);
      const initialValueBasis =
        table.options.meta?.initialValueBasis ?? "manual";
      if (count === 0) {
        return <div className="text-muted-foreground">No conditions</div>;
      }

      const summary = getConditionSummary({
        event: row.original,
        locale: table.options.meta?.locale,
      });
      const hasIncompatibleConditions =
        eventHasIncompatibleProjectedSeriesThresholdCondition(
          row.original,
          initialValueBasis,
        );

      return (
        <div>
          <p>{summary}</p>
          {hasIncompatibleConditions ? (
            <p className="text-xs text-amber-600">
              {getBasisCompatibilityDescription(initialValueBasis)}
            </p>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "actions",
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    cell: ({ row, table }) => <ActionsCell row={row} table={table} />,
  },
];
