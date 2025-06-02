"use client";

import { useState } from "react";

import { SearchInput } from "@/components/ui/search-input";
import { NewHoldingButton } from "@/components/dashboard/new-holding";
import { columns } from "@/components/dashboard/assets/table/columns";
import { DataTable } from "@/components/dashboard/assets/table/data-table";
import { TableActionsDropdown } from "@/components/dashboard/assets/dropdown-menu";

import type { Holding } from "@/types/global.types";

type GroupedHoldings = {
  [key: string]: {
    name: string;
    holdings: Holding[];
  };
};

export function HoldingsTables({ data }: { data: Holding[] }) {
  const [filterValue, setFilterValue] = useState("");

  // Group holdings by category without filtering (TanStack will handle filtering)
  const groupedHoldings = data.reduce((acc, holding) => {
    const { category_code, asset_categories } = holding;
    if (!acc[category_code]) {
      acc[category_code] = {
        name: asset_categories.name,
        holdings: [],
      };
    }
    acc[category_code].holdings.push(holding);
    return acc;
  }, {} as GroupedHoldings);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <SearchInput
          className="max-w-sm"
          placeholder="Search assets..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        <NewHoldingButton />
        <TableActionsDropdown />
      </div>
      {Object.entries(groupedHoldings).map(([code, { name, holdings }]) => (
        <DataTable
          key={code}
          columns={columns}
          data={holdings}
          title={name}
          filterValue={filterValue}
        />
      ))}
    </div>
  );
}
