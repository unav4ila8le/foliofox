"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";

import { SearchInput } from "@/components/ui/search-input";
import { NewHoldingButton } from "@/components/dashboard/new-holding";
import { columns } from "@/components/dashboard/assets/table/holdings/columns";
import { TableActionsDropdown } from "@/components/dashboard/assets/table/holdings/table-actions";
import { CollapsibleTable } from "../collapsible/collapsible-table";

import type { HoldingWithProfitLoss } from "@/types/global.types";

type GroupedHoldings = {
  [key: string]: {
    name: string;
    holdings: HoldingWithProfitLoss[];
  };
};

export function HoldingsTables({ data }: { data: HoldingWithProfitLoss[] }) {
  const [filterValue, setFilterValue] = useState("");
  const router = useRouter();

  // Handle row click to navigate to holding page
  const handleRowClick = useCallback(
    (holding: HoldingWithProfitLoss) => {
      router.push(`/dashboard/assets/${holding.id}`);
    },
    [router],
  );

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
        <NewHoldingButton variant="outline" />
        <TableActionsDropdown />
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-accent rounded-lg p-2">
            <Package className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">No holdings found</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Start building your portfolio by adding your first holding
          </p>
        </div>
      ) : (
        Object.entries(groupedHoldings).map(([code, { name, holdings }]) => (
          <CollapsibleTable
            key={code}
            columns={columns}
            data={holdings}
            title={name}
            filterValue={filterValue}
            onRowClick={handleRowClick}
          />
        ))
      )}
      <p className="text-muted-foreground text-end text-sm">
        {data.length} holding(s)
      </p>
    </div>
  );
}
