"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { SearchInput } from "@/components/ui/search-input";
import { DataTable } from "../base/data-table";
import { columns } from "./columns";

import type { TransformedHolding } from "@/types/global.types";

interface ArchivedTableProps {
  data: TransformedHolding[];
}

export function ArchivedTable({ data }: ArchivedTableProps) {
  const [filterValue, setFilterValue] = useState("");
  const router = useRouter();

  // Handle row click to navigate to holding page
  const handleRowClick = useCallback(
    (holding: TransformedHolding) => {
      router.push(`/dashboard/assets/${holding.id}`);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        className="max-w-sm"
        placeholder="Search archived assets..."
        value={filterValue}
        onChange={(e) => setFilterValue(e.target.value)}
      />
      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={data}
          filterValue={filterValue}
          onRowClick={handleRowClick}
        />
      </div>
      <p className="text-muted-foreground text-end text-sm">
        {data.length} archived holding(s)
      </p>
    </div>
  );
}
