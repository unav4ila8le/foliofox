import { addUTCDays } from "@/lib/date/date-utils";

export interface CronDateStats {
  date: string;
  totalRequests: number;
  successfulFetches: number;
  failedFetches: number;
  retryCount: number;
  failedBatchCount: number;
}

// Build rolling window: [D, D-1, D-2, ...].
export function buildDateWindow(anchorDate: Date, windowDays: number): Date[] {
  const safeWindowDays = Math.max(0, Math.trunc(windowDays));

  return Array.from({ length: safeWindowDays }, (_, offset) =>
    addUTCDays(anchorDate, -offset),
  );
}
