"use client";

import { ColumnDef } from "@tanstack/react-table";

import { formatNumber } from "@/lib/number/format";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Asset = {
  id: string;
  asset_name: string;
  currency: string;
  value: number;
  quantity: number;
  total_value: number;
};

export const columns: ColumnDef<Asset>[] = [
  {
    accessorKey: "asset_name",
    header: "Asset Name",
  },
  {
    accessorKey: "currency",
    header: "Currency",
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
