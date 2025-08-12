"use client";

import { ArrowUpDown } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ActionsCell } from "../row-actions/actions-cell";

import { cn } from "@/lib/utils";
import { formatNumber, formatPercentage } from "@/lib/number-format";

import type { ColumnDef } from "@tanstack/react-table";
import type { HoldingWithProfitLoss } from "@/types/global.types";

// Union type for table rows - holdings and category headers
type TableRow =
  | HoldingWithProfitLoss
  | {
      id: string;
      type: "category-header";
      categoryName: string;
      categoryCode: string;
      holdingCount: number;
    };

// Type guard to check if row is a category header
function isCategoryHeader(
  row: TableRow,
): row is Extract<TableRow, { type: "category-header" }> {
  return "type" in row && row.type === "category-header";
}

export const columns: ColumnDef<TableRow>[] = [
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
    cell: ({ row }) => {
      const rowData = row.original;

      // Category headers are not selectable
      if (isCategoryHeader(rowData)) {
        return null;
      }

      return (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      );
    },
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
      const rowData = row.original;

      // Render category header
      if (isCategoryHeader(rowData)) {
        return <div className="font-semibold">{rowData.categoryName}</div>;
      }

      // Render holding name
      const name = rowData.name;
      return (
        <div className="flex w-40 sm:w-64 lg:w-80">
          <TooltipProvider>
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <div className="truncate">{name}</div>
              </TooltipTrigger>
              <TooltipContent>{name}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
  },
  {
    accessorKey: "currency",
    header: "Currency",
    cell: ({ row }) => {
      const rowData = row.original;

      // Category headers don't have currency
      if (isCategoryHeader(rowData)) {
        return null;
      }

      return <Badge variant="secondary">{rowData.currency}</Badge>;
    },
  },
  {
    accessorKey: "current_quantity",
    header: "Quantity",
    cell: ({ row }) => {
      const rowData = row.original;

      // Category headers don't have quantity
      if (isCategoryHeader(rowData)) {
        return null;
      }

      return (
        <div className="tabular-nums">
          {formatNumber(rowData.current_quantity, undefined, {
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
      const rowData = row.original;

      // Category headers don't have unit value
      if (isCategoryHeader(rowData)) {
        return null;
      }

      return (
        <div className="tabular-nums">
          {formatNumber(rowData.current_unit_value, undefined, {
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
          Change
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row }) => {
      const rowData = row.original;

      // Category headers don't have profit/loss
      if (isCategoryHeader(rowData)) {
        return null;
      }

      const profit_loss = rowData.profit_loss;
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
          Change %
          <ArrowUpDown className="size-4" />
        </div>
      );
    },
    cell: ({ row }) => {
      const rowData = row.original;

      // Category headers don't have profit/loss percentage
      if (isCategoryHeader(rowData)) {
        return null;
      }

      const profit_loss_percentage = rowData.profit_loss_percentage;
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
      const rowData = row.original;

      // Category headers don't have total value
      if (isCategoryHeader(rowData)) {
        return null;
      }

      return (
        <div className="tabular-nums">
          {formatNumber(rowData.total_value, undefined, {
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
      const rowData = row.original;

      // Category headers don't have actions
      if (isCategoryHeader(rowData)) {
        return null;
      }
      return <ActionsCell holding={rowData} />;
    },
  },
];
