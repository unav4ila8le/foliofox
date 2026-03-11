"use client";

import { PlusIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";

import { useNewPortfolioRecordDialog } from "@/components/dashboard/new-portfolio-record";
import { useNewAssetDialog } from "@/components/dashboard/new-asset";

export function NewActionButton() {
  const { hasActivePositions } = useDashboardData();
  const { setOpen: setOpenNewPortfolioRecord } = useNewPortfolioRecordDialog();
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
        <DropdownMenuItem
          disabled={!hasActivePositions}
          onSelect={() => setOpenNewPortfolioRecord(true)}
        >
          New Record
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenNewAsset(true)}>
          New Asset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
