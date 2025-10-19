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
import { useNewAssetDialog } from "@/components/dashboard/new-asset";

export function NewActionButton() {
  const { setOpen: setOpenNewRecord } = useNewRecordDialog();
  const { setOpenSelectionDialog: setOpenNewAsset } = useNewAssetDialog();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <PlusIcon className="size-4" />
          New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onSelect={() => setOpenNewRecord(true)}>
          New Record
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenNewAsset(true)}>
          New Asset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
