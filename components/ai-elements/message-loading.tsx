"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type MessageLoadingProps = HTMLAttributes<HTMLDivElement> & {
  status: "streaming" | "submitted" | "ready" | "error";
};

export const MessageLoading = ({ status, className }: MessageLoadingProps) => (
  <div className={cn("flex flex-row items-center gap-3 text-sm", className)}>
    <span className="relative flex size-2.5 items-center justify-center">
      <span className="bg-brand absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
      <span className="bg-brand relative inline-flex size-2 rounded-full"></span>
    </span>
    {status === "streaming" ? "Responding..." : "Thinking..."}
  </div>
);
