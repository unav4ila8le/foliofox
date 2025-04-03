"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { formatNumber } from "@/lib/number/format";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Asset = {
  id: string;
  asset_name: string;
  asset_type: string;
  currency: string;
  value: number;
  quantity: number;
  total_value: number;
};

export const columns: ColumnDef<Asset>[] = [
  {
    accessorKey: "asset_name",
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
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => {
      const value = row.getValue<number>("value");

      return <div className="tabular-nums">{formatNumber(value, 2)}</div>;
    },
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
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
];
