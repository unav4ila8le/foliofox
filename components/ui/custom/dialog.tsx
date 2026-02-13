import * as React from "react";

import {
  DialogClose,
  DialogContent as DialogContentPrimitive,
  DialogDescription,
  DialogFooter as DialogFooterPrimitive,
  DialogHeader as DialogHeaderPrimitive,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  Dialog,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function DialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContentPrimitive>) {
  return (
    <DialogContentPrimitive
      className={cn(
        "flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeaderPrimitive>) {
  return <DialogHeaderPrimitive className={cn("p-6", className)} {...props} />;
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-6", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooterPrimitive>) {
  return (
    <DialogFooterPrimitive
      className={cn("bg-muted/50 border-t px-6 py-4", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
