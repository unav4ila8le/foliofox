"use client";

import { useState } from "react";
import { Download, MoreHorizontal, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportPortfolioRecordsDialog } from "@/components/dashboard/portfolio-records/export/dialog";

import { useImportPortfolioRecordsDialog } from "@/components/dashboard/portfolio-records/import";

export function TableActionsDropdown({
  recordsCount,
}: {
  recordsCount?: number;
}) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { setOpen: setOpenImportPortfolioRecordsDialog } =
    useImportPortfolioRecordsDialog();

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
          <DropdownMenuItem
            onSelect={() => setOpenImportPortfolioRecordsDialog(true)}
          >
            <Upload className="size-4" /> Import records
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setShowExportDialog(true)}
            disabled={!recordsCount || recordsCount === 0}
          >
            <Download className="size-4" /> Export records
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportPortfolioRecordsDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        recordsCount={recordsCount}
      />
    </>
  );
}
