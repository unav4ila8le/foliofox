"use client";

import { ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

import { ActionsCell } from "./row-actions/actions-cell";

import { formatNumber } from "@/lib/number/format";

import type { ColumnDef } from "@tanstack/react-table";
import type { TransformedRecord } from "@/types/global.types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const columns: ColumnDef<TransformedRecord>[] = [
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
    accessorKey: "value",
    header: "Unit Value",
    cell: ({ row }) => {
      const value = row.getValue<number>("value");
      return (
        <div className="tabular-nums">
          {formatNumber(value, undefined, { maximumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "total_value",
    header: "Total Value",
    cell: ({ row }) => {
      const total_value = row.getValue<number>("total_value");
      return <div className="tabular-nums">{formatNumber(total_value, 2)}</div>;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const description = row.getValue<string | null>("description");
      return (
        <TooltipProvider>
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
        </TooltipProvider>
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
      const record = row.original;
      return <ActionsCell record={record} />;
    },
  },
];
