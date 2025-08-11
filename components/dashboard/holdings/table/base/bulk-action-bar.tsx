"use client";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BulkAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  loading?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  actions,
  className,
}: BulkActionBarProps) {
  return (
    <div
      className={cn(
        "bg-background animate-in fade-in-0 slide-in-from-bottom-8 fixed right-8 bottom-6 z-50 flex items-center gap-2 rounded-xl border p-2 shadow-lg duration-200 ease-out",
        className,
      )}
    >
      <span className="text-muted-foreground px-2 text-sm">
        {selectedCount} selected
      </span>
      {actions.map((action, idx) => (
        <Button
          key={idx}
          variant={action.variant ?? "outline"}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.loading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            action.icon
          )}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
