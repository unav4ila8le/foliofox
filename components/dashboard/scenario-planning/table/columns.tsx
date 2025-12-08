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
import { format } from "date-fns";
import type { ScenarioEvent } from "@/lib/scenario-planning";

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
  const index = table
    .getSortedRowModel()
    .rows.findIndex((r) => r.id === row.id);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            // @ts-expect-error - meta is typed but onEdit is custom
            table.options.meta?.onEdit(row.original, index);
            setOpen(false);
          }}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => {
            // @ts-expect-error - meta is typed but onDelete is custom
            table.options.meta?.onDelete(index);
            setOpen(false);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getEventStartDate(event: ScenarioEvent): Date | null {
  const dateRangeCondition = event.unlockedBy.find(
    (c) => c.tag === "cashflow" && c.type === "date-in-range",
  );

  if (dateRangeCondition && dateRangeCondition.type === "date-in-range") {
    const ld = dateRangeCondition.value.start;
    return new Date(ld.y, ld.m - 1, ld.d);
  }

  const dateIsCondition = event.unlockedBy.find(
    (c) => c.tag === "cashflow" && c.type === "date-is",
  );

  if (dateIsCondition && dateIsCondition.type === "date-is") {
    const ld = dateIsCondition.value;
    return new Date(ld.y, ld.m - 1, ld.d);
  }

  return null;
}

function getEventEndDate(event: ScenarioEvent): Date | null {
  const dateRangeCondition = event.unlockedBy.find(
    (c) => c.tag === "cashflow" && c.type === "date-in-range",
  );

  if (
    dateRangeCondition &&
    dateRangeCondition.type === "date-in-range" &&
    dateRangeCondition.value.end
  ) {
    const ld = dateRangeCondition.value.end;
    return new Date(ld.y, ld.m - 1, ld.d);
  }

  return null;
}

function getAdditionalConditionsCount(event: ScenarioEvent): number {
  return event.unlockedBy.filter((c) => c.tag === "balance").length;
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
      return <div className="font-medium">{name}</div>;
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue<"income" | "expense">("type");
      return (
        <Badge variant={type === "income" ? "default" : "secondary"}>
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
          className="hover:text-primary flex cursor-pointer items-center justify-end gap-2 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Amount
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    cell: ({ row }) => {
      const amount = row.getValue<number>("amount");
      return (
        <div className="font-medium tabular-nums">
          {amount.toLocaleString()}
        </div>
      );
    },
  },
  {
    id: "startDate",
    header: "Start Date",
    cell: ({ row }) => {
      const startDate = getEventStartDate(row.original);
      if (!startDate) return <span className="text-muted-foreground">-</span>;
      return <div className="text-sm">{format(startDate, "MMM d, yyyy")}</div>;
    },
  },
  {
    id: "recurrence",
    header: "Recurrence",
    cell: ({ row }) => {
      const event = row.original;
      const isRecurring = event.recurrence.type !== "once";

      if (!isRecurring) {
        return <span className="text-muted-foreground text-sm">Once</span>;
      }

      return <div className="text-sm capitalize">{event.recurrence.type}</div>;
    },
  },
  {
    id: "endDate",
    header: "End Date",
    cell: ({ row }) => {
      const event = row.original;
      const isRecurring = event.recurrence.type !== "once";

      if (!isRecurring) {
        return <span className="text-muted-foreground">-</span>;
      }

      const endDate = getEventEndDate(event);
      if (!endDate) {
        return <span className="text-muted-foreground text-sm">Never</span>;
      }

      return <div className="text-sm">{format(endDate, "MMM d, yyyy")}</div>;
    },
  },
  {
    id: "conditions",
    header: "Conditions",
    cell: ({ row }) => {
      const count = getAdditionalConditionsCount(row.original);
      if (count === 0) {
        return (
          <span className="text-muted-foreground text-sm">No conditions</span>
        );
      }
      return (
        <div className="text-sm">
          {count} condition{count > 1 ? "s" : ""}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => <ActionsCell row={row} table={table} />,
  },
];
