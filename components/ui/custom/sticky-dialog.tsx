import * as React from "react";

import {
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function StickyDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        "flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0",
        className,
      )}
      {...props}
    />
  );
}

function StickyDialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={cn("px-6 py-4", className)} {...props} />;
}

function StickyDialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-4", className)}
      {...props}
    />
  );
}

function StickyDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn("bg-muted/50 border-t px-6 py-4", className)}
      {...props}
    />
  );
}

export {
  StickyDialogBody,
  StickyDialogContent,
  StickyDialogFooter,
  StickyDialogHeader,
};
