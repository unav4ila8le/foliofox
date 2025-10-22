"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Upload, Download, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportAssetsDialog } from "@/components/dashboard/positions/asset/export/dialog";

import { useImportPositionsDialog } from "@/components/dashboard/positions/import";

export function TableActionsDropdown({
  positionsCount,
}: {
  positionsCount?: number;
}) {
  const [showExportDialog, setShowExportDialog] = useState(false);

  const { setOpen: setOpenImportPositionsDialog } = useImportPositionsDialog();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpenImportPositionsDialog(true)}>
            <Upload className="size-4" /> Import
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setShowExportDialog(true)}
            disabled={!positionsCount || positionsCount === 0}
          >
            <Download className="size-4" /> Export
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/assets/archived">
              <Archive className="size-4" /> View archived
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Export Assets Dialog */}
      <ExportAssetsDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        positionsCount={positionsCount}
      />
    </>
  );
}
