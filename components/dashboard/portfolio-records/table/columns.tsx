"use client";

import Link from "next/link";
import { ArrowUpDown } from "lucide-react";

import { ActionsCell } from "./row-actions/actions-cell";

import { formatNumber } from "@/lib/number-format";
import { formatDate } from "@/lib/date/date-format";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import type { ColumnDef } from "@tanstack/react-table";
import type { PortfolioRecordWithPosition } from "@/types/global.types";

export function getPortfolioRecordColumns({
  showPositionColumn = false,
}: {
  showPositionColumn?: boolean;
}): ColumnDef<PortfolioRecordWithPosition>[] {
  const base: ColumnDef<PortfolioRecordWithPosition>[] = [
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
      header: ({ column }) => (
        <div
          className="hover:text-primary flex cursor-pointer items-center gap-2 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="size-4" />
        </div>
      ),
      cell: ({ row, table }) => {
        const locale = table.options.meta?.locale;
        const date = new Date(row.getValue<string>("date"));
        return formatDate(date, { locale });
      },
    },
  ];

  const positionCol: ColumnDef<PortfolioRecordWithPosition> = {
    id: "position",
    header: "Position",
    accessorFn: (row) => row.positions?.name ?? "",
    cell: ({ row }) => {
      const position = row.original.positions;
      const positionName = position?.name ?? "";
      const positionId = position?.id;
      if (!positionId) {
        return (
          <div className="max-w-60 truncate" title={positionName}>
            <span className="text-muted-foreground italic">Unknown</span>
          </div>
        );
      }
      return (
        <div className="flex w-40 sm:w-64 lg:w-80">
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Link
                href={`/dashboard/${position.type === "liability" ? "liabilities" : "assets"}/${positionId}`}
                className="hover:text-primary truncate underline-offset-4 hover:underline"
                title={positionName}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open ${positionName}`}
              >
                {positionName}
              </Link>
            </TooltipTrigger>
            <TooltipContent>{positionName}</TooltipContent>
          </Tooltip>
        </div>
      );
    },
  };

  const rest: ColumnDef<PortfolioRecordWithPosition>[] = [
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue<string>("type");
        return (
          <Badge variant="outline" className="uppercase">
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Quantity",
      cell: ({ row, table }) => {
        const locale = table.options.meta?.locale;
        const quantity = row.getValue<number>("quantity");
        return (
          <div className="tabular-nums">
            {formatNumber(quantity, { locale, maximumFractionDigits: 6 })}
          </div>
        );
      },
    },
    {
      accessorKey: "unit_value",
      header: "Unit Value",
      cell: ({ row, table }) => {
        const locale = table.options.meta?.locale;
        const unit_value = row.getValue<number>("unit_value");
        return (
          <div className="tabular-nums">
            {formatNumber(unit_value, { locale, maximumFractionDigits: 2 })}
          </div>
        );
      },
    },
    {
      id: "total_value",
      header: "Total Value",
      cell: ({ row, table }) => {
        const locale = table.options.meta?.locale;
        const quantity = row.getValue<number>("quantity") ?? 0;
        const unit_value = row.getValue<number>("unit_value") ?? 0;
        const total_value = quantity * unit_value;
        return (
          <div className="tabular-nums">
            {formatNumber(total_value, { locale, maximumFractionDigits: 2 })}
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
                  <span className="text-muted-foreground pe-1 italic">
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
        const portfolioRecord = row.original;
        return <ActionsCell portfolioRecord={portfolioRecord} />;
      },
    },
  ];

  return showPositionColumn
    ? [...base, positionCol, ...rest]
    : [...base, ...rest];
}
