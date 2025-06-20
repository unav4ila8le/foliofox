"use client";

import { ArrowUpDown } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Badge } from "@/components/ui/badge";
import { ActionsCell } from "../row-actions/actions-cell";

import { formatNumber } from "@/lib/number/format";

import type { ColumnDef } from "@tanstack/react-table";
import type { TransformedHolding } from "@/types/global.types";

export const columns: ColumnDef<TransformedHolding>[] = [
  {
    accessorKey: "name",
    maxSize: 248,
    minSize: 128,
    size: 248,
    header: ({ column }) => {
      return (
        <div
          className="hover:text-primary flex cursor-pointer items-center gap-2 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Asset name
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row }) => {
      const name = row.getValue<string>("name");
      return (
        <TooltipProvider>
          <Tooltip delayDuration={500}>
            <TooltipTrigger>
              <div className="max-w-60 truncate text-start">{name}</div>
            </TooltipTrigger>
            <TooltipContent>{name}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: "currency",
    header: "Currency",
    cell: ({ row }) => {
      const currency = row.getValue<string>("currency");

      return <Badge variant="secondary">{currency}</Badge>;
    },
  },
  {
    accessorKey: "current_quantity",
    header: "Quantity",
    cell: ({ row }) => {
      const current_quantity = row.getValue<number>("current_quantity");
      return (
        <div className="tabular-nums">
          {formatNumber(current_quantity, undefined, {
            maximumFractionDigits: 6,
          })}
        </div>
      );
    },
  },
  {
    accessorKey: "current_unit_value",
    header: "Unit value",
    cell: ({ row }) => {
      const unit_value = row.getValue<number>("current_unit_value");

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
      const total_value = row.getValue<number>("total_value");

      return (
        <div className="tabular-nums">
          {formatNumber(total_value, undefined, { maximumFractionDigits: 2 })}
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
    cell: ({ row }) => {
      const holding = row.original;
      return <ActionsCell holding={holding} />;
    },
  },
];
