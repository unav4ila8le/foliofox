"use client";

import { PlusIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { useNewRecordDialog } from "@/components/dashboard/new-record";
import { useNewHoldingDialog } from "@/components/dashboard/new-holding";

export function NewActionButton() {
  const { setOpen: setOpenRecord } = useNewRecordDialog();
  const { setOpen: setOpenHolding } = useNewHoldingDialog();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <PlusIcon className="size-4" />
          New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onSelect={() => setOpenRecord(true)}>
          New Record
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenHolding(true)}>
          New Holding
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
