"use client";

import { ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ActionsCell } from "../row-actions/actions-cell";

import { cn } from "@/lib/utils";
import { formatNumber, formatPercentage } from "@/lib/number-format";

import { HoldingWithProfitLoss } from "@/types/global.types";

export const columns: ColumnDef<HoldingWithProfitLoss>[] = [
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
  // Category header - hidden
  {
    accessorKey: "category_code",
    header: () => null,
    cell: () => null,
    enableSorting: false,
    enableHiding: false,
    size: 0,
    minSize: 0,
    maxSize: 0,
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
      if (row.getIsGrouped()) {
        // group row → show category name and number of holdings aligned under Name column
        const firstLeaf = row.getLeafRows()[0];
        const categoryName = firstLeaf?.original.asset_categories.name;
        return (
          <div className="flex items-center gap-2 font-semibold">
            {categoryName}
            <Badge variant="secondary" className="font-semibold">
              {row.getLeafRows().length}
            </Badge>
          </div>
        );
      }

      const name = row.getValue<string>("name");
      return (
        <div className="flex w-40 sm:w-64 lg:w-80">
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <div className="hover:text-primary truncate underline-offset-4 hover:underline">
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
      const current_unit_value = row.getValue<number>("current_unit_value");
      return (
        <div className="tabular-nums">
          {formatNumber(current_unit_value, undefined, {
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
  },
  {
    accessorKey: "cost_basis_per_unit",
    header: "Cost basis",
    cell: ({ row }) => {
      const hasMarketData = !!row.original.symbol_id;
      if (!hasMarketData) {
        return <span className="text-muted-foreground">-</span>;
      }

      const cost_basis_per_unit = row.getValue<number>("cost_basis_per_unit");
      return (
        <div className="tabular-nums">
          {formatNumber(cost_basis_per_unit, undefined, {
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
  },
  {
    accessorKey: "profit_loss",
    header: ({ column }) => {
      return (
        <div
          className="hover:text-primary flex cursor-pointer items-center gap-2 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          P/L
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row }) => {
      const hasMarketData = !!row.original.symbol_id;
      if (!hasMarketData) {
        return <span className="text-muted-foreground">-</span>;
      }

      const profit_loss = row.getValue<number>("profit_loss");
      const isPositive = profit_loss >= 0;

      return (
        <div
          className={cn(
            "tabular-nums",
            isPositive ? "text-green-600" : "text-red-600",
          )}
        >
          {isPositive ? "+" : ""}
          {formatNumber(profit_loss, undefined, { maximumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "profit_loss_percentage",
    header: ({ column }) => {
      return (
        <div
          className="hover:text-primary flex cursor-pointer items-center gap-2 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          P/L %
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row }) => {
      const hasMarketData = !!row.original.symbol_id;
      if (!hasMarketData) {
        return <span className="text-muted-foreground">-</span>;
      }

      const profit_loss_percentage = row.getValue<number>(
        "profit_loss_percentage",
      );
      const isPositive = profit_loss_percentage >= 0;

      return (
        <div
          className={cn(
            "tabular-nums",
            isPositive ? "text-green-600" : "text-red-600",
          )}
        >
          {isPositive ? "+" : ""}
          {formatPercentage(profit_loss_percentage)}
        </div>
      );
    },
  },
  {
    accessorKey: "total_value",
    header: ({ column }) => {
      return (
        <div
          className="hover:text-primary flex cursor-pointer items-center gap-2 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total value
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row }) => {
      const total_value = row.getValue<number>("total_value");
      return (
        <div className="tabular-nums">
          {formatNumber(total_value, undefined, {
            maximumFractionDigits: 2,
          })}
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
