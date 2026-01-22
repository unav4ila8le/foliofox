"use client";

import { ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ActionsCell } from "@/components/dashboard/positions/asset/table/row-actions/actions-cell";

import { formatNumber } from "@/lib/number-format";

import type { ColumnDef } from "@tanstack/react-table";
import type { TransformedPosition } from "@/types/global.types";

export const columns: ColumnDef<TransformedPosition>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 32,
  },
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
              <div className="truncate underline-offset-4 hover:underline">
                {name}
              </div>
            </TooltipTrigger>
            <TooltipContent>{name}</TooltipContent>
          </Tooltip>
        </div>
      );
    },
  },
  {
    accessorKey: "currency",
    header: "Currency",
    cell: ({ row }) => {
      const currency = row.getValue<string>("currency");

      return <Badge variant="outline">{currency}</Badge>;
    },
  },
  {
    accessorKey: "current_quantity",
    header: "Quantity",
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    cell: ({ row, table }) => {
      const locale = table.options.meta?.locale;
      const current_quantity = row.getValue<number>("current_quantity");
      return (
        <div className="tabular-nums">
          {formatNumber(current_quantity, { locale, maximumFractionDigits: 6 })}
        </div>
      );
    },
  },
  {
    accessorKey: "current_unit_value",
    header: "Unit value",
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    cell: ({ row, table }) => {
      const locale = table.options.meta?.locale;
      const unit_value = row.getValue<number>("current_unit_value");

      return (
        <div className="tabular-nums">
          {formatNumber(unit_value, { locale, maximumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "total_value",
    header: "Total Value",
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    cell: ({ row, table }) => {
      const locale = table.options.meta?.locale;
      const total_value = row.getValue<number>("total_value");

      return (
        <div className="tabular-nums">
          {formatNumber(total_value, { locale, maximumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "archived_at",
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    header: ({ column }) => {
      return (
        <div
          className="hover:text-primary flex cursor-pointer items-center justify-end gap-2 ps-16 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Archived on
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row }) => {
      const archived_at = row.getValue<Date>("archived_at");

      return format(archived_at, "PPP");
    },
  },
  {
    id: "actions",
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    cell: ({ row }) => {
      const position = row.original;
      return <ActionsCell position={position} />;
    },
  },
];
