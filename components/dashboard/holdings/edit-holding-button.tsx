"use client";

import { useState } from "react";
import { SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UpdateHoldingDialog } from "@/components/dashboard/holdings/table/row-actions/update-holding";

import type { Holding } from "@/types/global.types";

interface Props {
  holding: Holding;
}

export function EditHoldingButton({ holding }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-auto gap-1 rounded-md px-2 py-0.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <SquarePen className="size-3" />
        Edit Holding
      </Button>
      <UpdateHoldingDialog
        holding={holding}
        open={open}
        onOpenChangeAction={setOpen}
      />
    </>
  );
}
