"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { UpdatePortfolioRecordDialog } from "./update-dialog";
import { DeletePortfolioRecordDialog } from "./delete-dialog";

import type { PortfolioRecordWithPosition } from "@/types/global.types";

export function ActionsCell({
  portfolioRecord,
}: {
  portfolioRecord: PortfolioRecordWithPosition;
}) {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="size-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setShowUpdateDialog(true)}>
            <SquarePen className="size-4" /> Edit record
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setShowDeleteDialog(true)}
            variant="destructive"
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdatePortfolioRecordDialog
        portfolioRecord={portfolioRecord}
        open={showUpdateDialog}
        onOpenChangeAction={setShowUpdateDialog}
      />

      <DeletePortfolioRecordDialog
        portfolioRecords={[{ id: portfolioRecord.id }]} // Minimal DTO
        open={showDeleteDialog}
        onOpenChangeAction={setShowDeleteDialog}
      />
    </>
  );
}
