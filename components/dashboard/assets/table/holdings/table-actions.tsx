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
import { ExportDialog } from "@/components/dashboard/assets/export/dialog";

import { useImportHoldingsDialog } from "@/components/dashboard/assets/import";

export function TableActionsDropdown() {
  const [showExportDialog, setShowExportDialog] = useState(false);

  const { setOpen: setOpenImportHoldingsDialog } = useImportHoldingsDialog();

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
          <DropdownMenuItem onSelect={() => setOpenImportHoldingsDialog(true)}>
            <Upload className="size-4" /> Import
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowExportDialog(true)}>
            <Download className="size-4" /> Export
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/assets/archived">
              <Archive className="size-4" /> View archived
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
    </>
  );
}
