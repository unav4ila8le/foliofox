"use client";

import { ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ActionsCell } from "./actions-cell";

import { formatNumber } from "@/lib/number/format";

import type { ColumnDef } from "@tanstack/react-table";
import type { Holding } from "@/types/global.types";

export const columns: ColumnDef<Holding>[] = [
  {
    accessorKey: "name",
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
  },
  {
    accessorKey: "current_value",
    header: "Value",
    cell: ({ row }) => {
      const value = row.getValue<number>("current_value");

      return <div className="tabular-nums">{formatNumber(value, 2)}</div>;
    },
  },
  {
    accessorKey: "total_value",
    header: () => <div className="text-right">Total Value</div>,
    cell: ({ row }) => {
      const total_value = row.getValue<number>("total_value");

      return (
        <div className="text-right tabular-nums">
          {formatNumber(total_value, 2)}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const holding = row.original;
      return (
        <div className="text-right">
          <ActionsCell holding={holding} />
        </div>
      );
    },
  },
];
