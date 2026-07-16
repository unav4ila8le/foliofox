import { parseUTCDateKey } from "@/lib/date/date-utils";

import type { BrokerTransactionRecordDraft } from "./types";

/**
 * Deterministic transaction IDs for brokers whose exports carry no per-row ID.
 *
 * The ID is built from normalized (parsed) row values, so cosmetic formatting
 * changes in future exports ("2500,5" vs "2500,50") keep the same ID and
 * re-uploads stay idempotent. Identical rows (e.g. two equal fills of one
 * order) get an occurrence suffix so both import.
 */
export function createSyntheticTransactionIdFactory() {
  const occurrences = new Map<string, number>();

  return (parts: Array<string | number>): string => {
    const key = parts.map((part) => String(part)).join("|");
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    return `${key}#${occurrence}`;
  };
}

export function compareBrokerRecordOrder(
  left: BrokerTransactionRecordDraft,
  right: BrokerTransactionRecordDraft,
) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  const leftTime = left.executedAt ?? "";
  const rightTime = right.executedAt ?? "";
  if (leftTime !== rightTime) {
    return leftTime.localeCompare(rightTime);
  }

  return left.sourceRowNumber - right.sourceRowNumber;
}

/**
 * Infer the pre-history holding for a position from its parsed records.
 *
 * Date-ranged broker exports can contain sells whose buys happened before the
 * export window. The largest running shortfall is the minimum quantity the
 * user must have held before the first record; importing starts the position
 * from that opening balance instead of zero so the timeline stays valid.
 */
export function inferOpeningQuantity(
  records: BrokerTransactionRecordDraft[],
): number {
  let runningQuantity = 0;
  let largestShortfall = 0;

  for (const record of [...records].sort(compareBrokerRecordOrder)) {
    runningQuantity +=
      record.type === "sell" ? -record.quantity : record.quantity;
    largestShortfall = Math.min(largestShortfall, runningQuantity);
  }

  // Math.max also normalizes the no-shortfall case away from -0.
  return Math.max(0, -largestShortfall);
}

/**
 * Synthesize `executedAt` from file order for exports without execution
 * timestamps. Same-date trades otherwise fall back to ascending row number,
 * which is reverse-chronological in the usual newest-first broker exports and
 * can misorder same-day buy/sell sequences during import.
 */
export function assignFileOrderExecutedAt(
  records: BrokerTransactionRecordDraft[],
) {
  if (records.length === 0) return;

  const isChronological = records[0].date <= records[records.length - 1].date;
  records.forEach((record, index) => {
    const offsetMs = isChronological ? index : records.length - 1 - index;
    record.executedAt = new Date(
      parseUTCDateKey(record.date).getTime() + offsetMs,
    ).toISOString();
  });
}
