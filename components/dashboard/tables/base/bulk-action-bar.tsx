"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSidebar } from "@/components/ui/custom/sidebar";

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
  const { openRight } = useSidebar();
  // Keep the bar fixed to the viewport, but when the right desktop sidebar is
  // open we shift it left by that sidebar width so it stays inside main content.
  const rightOffset = openRight
    ? "calc(var(--sidebar-right-width) + 1rem)"
    : undefined;

  return (
    <div
      style={{ right: rightOffset }}
      className={cn(
        "bg-background animate-in fade-in-0 slide-in-from-bottom-8 fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-xl border p-2 shadow-lg duration-200 ease-out md:right-8",
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
          {action.loading ? <Spinner /> : action.icon}
          <span className={cn(action.icon && "sr-only md:not-sr-only")}>
            {action.label}
          </span>
        </Button>
      ))}
    </div>
  );
}
