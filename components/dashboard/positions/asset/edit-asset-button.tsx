"use client";

import { useState } from "react";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UpdateAssetDialog } from "./update";

import type { Position } from "@/types/global.types";

interface Props {
  position: Position;
  currentSymbolTicker?: string | null;
}

export function EditAssetButton({ position, currentSymbolTicker }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-auto gap-1 rounded-md px-2 py-0.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Settings className="size-3" />
        Edit details
      </Button>
      <UpdateAssetDialog
        position={position}
        currentSymbolTicker={currentSymbolTicker}
        open={open}
        onOpenChangeAction={setOpen}
      />
    </>
  );
}
