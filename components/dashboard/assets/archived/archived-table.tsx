"use client";

import { useState } from "react";

import { SearchInput } from "@/components/ui/search-input";
import { DataTable } from "../table/base/data-table";
import { columns } from "../table/columns";

import type { Holding } from "@/types/global.types";

interface ArchivedTableProps {
  data: Holding[];
}

export function ArchivedTable({ data }: ArchivedTableProps) {
  const [filterValue, setFilterValue] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        className="max-w-sm"
        placeholder="Search archived assets..."
        value={filterValue}
        onChange={(e) => setFilterValue(e.target.value)}
      />
      <div className="rounded-md border">
        <DataTable columns={columns} data={data} filterValue={filterValue} />
      </div>
    </div>
  );
}
