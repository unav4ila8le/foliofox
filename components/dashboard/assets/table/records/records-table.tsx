"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import { SearchInput } from "@/components/ui/search-input";
import { DataTable } from "@/components/dashboard/assets/table/base/data-table";
import { columns } from "@/components/dashboard/assets/table/records/columns";
import { NewRecordButton } from "@/components/dashboard/new-record";

import type {
  TransformedRecord,
  TransformedHolding,
} from "@/types/global.types";

interface RecordsTableProps {
  data: TransformedRecord[];
  holding: TransformedHolding;
}

export function RecordsTable({ data, holding }: RecordsTableProps) {
  const [filterValue, setFilterValue] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <SearchInput
          className="max-w-sm"
          placeholder="Search records..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        {data.length > 0 && (
          <NewRecordButton variant="outline" preselectedHolding={holding} />
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-accent rounded-lg p-2">
            <FileText className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">No records found</p>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Records for this holding will appear here
          </p>
          <NewRecordButton variant="outline" preselectedHolding={holding} />
        </div>
      ) : (
        <div className="rounded-md border">
          <DataTable
            columns={columns}
            data={data}
            filterValue={filterValue}
            filterColumnId="description"
          />
        </div>
      )}

      <p className="text-muted-foreground text-end text-sm">
        {data.length} record(s)
      </p>
    </div>
  );
}
