"use client";

import { ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

import { ActionsCell } from "./row-actions/actions-cell";

import { formatNumber } from "@/lib/number-format";
import { getTransactionTypeLabel } from "@/lib/asset-category-mappings";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import type { ColumnDef } from "@tanstack/react-table";
import type { Transaction } from "@/types/global.types";

export const columns: ColumnDef<Transaction>[] = [
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
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <div
          className="hover:text-primary flex cursor-pointer items-center gap-2 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue<string>("date"));
      return format(date, "PPP");
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue<string>("type");
      return (
        <Badge variant="secondary" className="uppercase">
          {getTransactionTypeLabel(type)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => {
      const quantity = row.getValue<number>("quantity");
      return (
        <div className="tabular-nums">
          {formatNumber(quantity, undefined, { maximumFractionDigits: 6 })}
        </div>
      );
    },
  },
  {
    accessorKey: "unit_value",
    header: "Unit Value",
    cell: ({ row }) => {
      const unit_value = row.getValue<number>("unit_value");
      return (
        <div className="tabular-nums">
          {formatNumber(unit_value, undefined, { maximumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "total_value",
    header: "Total Value",
    cell: ({ row }) => {
      const quantity = row.getValue<number>("quantity");
      const unit_value = row.getValue<number>("unit_value");
      const total_value = quantity * unit_value;
      return (
        <div className="tabular-nums">
          {formatNumber(total_value, undefined, { maximumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    accessorFn: (row) => row.description || "",
    cell: ({ row }) => {
      const description = row.getValue<string | null>("description");
      return (
        <Tooltip delayDuration={500}>
          <TooltipTrigger>
            <div className="max-w-60 truncate">
              {description || (
                <span className="text-muted-foreground italic">
                  No description
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>{description || "No description"}</TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    id: "actions",
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    cell: ({ row }) => {
      const transaction = row.original;
      return <ActionsCell transaction={transaction} />;
    },
  },
];
