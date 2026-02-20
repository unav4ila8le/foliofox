"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type MessageLoadingProps = HTMLAttributes<HTMLDivElement>;

export const MessageLoading = ({
  className,
  ...props
}: MessageLoadingProps) => (
  <div
    className={cn(
      "relative flex size-2.5 items-center justify-center",
      className,
    )}
    {...props}
  >
    <span className="bg-brand absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
    <span className="bg-brand relative inline-flex size-2 rounded-full"></span>
  </div>
);
