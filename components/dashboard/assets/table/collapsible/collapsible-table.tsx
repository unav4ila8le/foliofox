"use client";

import { ChevronDownIcon } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "../base/data-table";

interface CollapsibleTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  title: string;
  filterValue: string;
}

export function CollapsibleTable<TData, TValue>({
  columns,
  data,
  title,
  filterValue,
}: CollapsibleTableProps<TData, TValue>) {
  return (
    <Collapsible defaultOpen={true} className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 p-2">
        <div className="font-semibold">{title}</div>
        <Badge variant="secondary">{data.length}</Badge>
        <ChevronDownIcon className="text-muted-foreground ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden border-t">
        <DataTable columns={columns} data={data} filterValue={filterValue} />
      </CollapsibleContent>
    </Collapsible>
  );
}
