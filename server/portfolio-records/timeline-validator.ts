import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { PortfolioRecord } from "@/types/global.types";

/**
 * Portfolio record timeline validation utilities.
 *
 * Purpose:
 * - enforce server-side quantity constraints by record type
 * - validate timeline consistency before create/update/import writes
 * - reject historical oversells instead of allowing recalc clamping to hide them
 *
 * Validation model:
 * - records are evaluated in deterministic order: date, then created_at, then id
 * - running quantity is initialized from the latest valid snapshot at/before the
 *   first affected date
 * - buy increments quantity, sell decrements quantity, update resets quantity
 */
const NEW_RECORD_CREATED_AT_SORT_KEY = "9999-12-31T23:59:59.999Z";
const SELL_EPSILON = 1e-9;

type TimelineRecord = {
  id?: string;
  position_id: string;
  type: PortfolioRecord["type"];
  date: string;
  quantity: number;
  created_at?: string | null;
  sourceLabel?: string;
};

type ValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      code: string;
      message: string;
    };

interface ValidateTimelineWindowOptions {
  supabase: SupabaseClient<Database>;
  userId: string;
  positionId: string;
  records: TimelineRecord[];
}

function getSourcePrefix(sourceLabel?: string) {
  return sourceLabel ? `${sourceLabel}: ` : "";
}

function sortTimelineRecords(records: TimelineRecord[]) {
  return [...records].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    const leftCreatedAt = left.created_at ?? NEW_RECORD_CREATED_AT_SORT_KEY;
    const rightCreatedAt = right.created_at ?? NEW_RECORD_CREATED_AT_SORT_KEY;

    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt.localeCompare(rightCreatedAt);
    }

    return (left.id ?? "").localeCompare(right.id ?? "");
  });
}

export function validateRecordQuantityByType(
  record: Pick<TimelineRecord, "type" | "quantity"> & {
    sourceLabel?: string;
  },
): ValidationResult {
  const sourcePrefix = getSourcePrefix(record.sourceLabel);

  if (!Number.isFinite(record.quantity)) {
    return {
      valid: false,
      code: "INVALID_QUANTITY",
      message: `${sourcePrefix}Quantity must be a valid number.`,
    };
  }

  if (
    (record.type === "buy" || record.type === "sell") &&
    record.quantity <= 0
  ) {
    const label = record.type === "sell" ? "Sell" : "Buy";

    return {
      valid: false,
      code: "INVALID_QUANTITY",
      message: `${sourcePrefix}${label} quantity must be greater than 0.`,
    };
  }

  if (record.type === "update" && record.quantity < 0) {
    return {
      valid: false,
      code: "INVALID_QUANTITY",
      message: `${sourcePrefix}Update quantity must be 0 or greater.`,
    };
  }

  return { valid: true };
}

async function fetchBaseQuantityBeforeWindow(options: {
  supabase: SupabaseClient<Database>;
  userId: string;
  positionId: string;
  beforeOrAtDate: string;
  affectedRecordIds: Set<string>;
}): Promise<ValidationResult & { quantity?: number }> {
  const { supabase, userId, positionId, beforeOrAtDate, affectedRecordIds } =
    options;

  const affectedIds = Array.from(affectedRecordIds);

  let snapshotQuery = supabase
    .from("position_snapshots")
    .select("quantity, portfolio_record_id")
    .eq("user_id", userId)
    .eq("position_id", positionId)
    .lte("date", beforeOrAtDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (affectedIds.length > 0) {
    snapshotQuery = snapshotQuery.or(
      `portfolio_record_id.is.null,portfolio_record_id.not.in.(${affectedIds.join(",")})`,
    );
  }

  const { data: snapshots, error: snapshotsError } = await snapshotQuery;

  if (snapshotsError) {
    return {
      valid: false,
      code: snapshotsError.code ?? "SNAPSHOT_FETCH_FAILED",
      message:
        snapshotsError.message ?? "Failed to fetch snapshots for validation",
    };
  }

  const snapshot = snapshots?.[0];
  if (!snapshot) {
    return { valid: true, quantity: 0 };
  }

  return { valid: true, quantity: Number(snapshot.quantity ?? 0) };
}

export async function validatePortfolioRecordTimelineWindow(
  options: ValidateTimelineWindowOptions,
): Promise<ValidationResult> {
  const { supabase, userId, positionId, records } = options;

  if (records.length === 0) {
    return { valid: true };
  }

  const sortedRecords = sortTimelineRecords(records);

  for (const record of sortedRecords) {
    const quantityValidation = validateRecordQuantityByType(record);
    if (!quantityValidation.valid) {
      return quantityValidation;
    }
  }

  const firstAffectedDate = sortedRecords[0].date;
  const affectedRecordIds = new Set(
    sortedRecords
      .map((record) => record.id)
      .filter((id): id is string => Boolean(id)),
  );

  const baseQuantityResult = await fetchBaseQuantityBeforeWindow({
    supabase,
    userId,
    positionId,
    beforeOrAtDate: firstAffectedDate,
    affectedRecordIds,
  });

  if (!baseQuantityResult.valid) {
    return baseQuantityResult;
  }

  let runningQuantity = Number(baseQuantityResult.quantity ?? 0);

  for (const record of sortedRecords) {
    if (record.type === "buy") {
      runningQuantity += record.quantity;
      continue;
    }

    if (record.type === "sell") {
      if (record.quantity - runningQuantity > SELL_EPSILON) {
        return {
          valid: false,
          code: "INSUFFICIENT_QUANTITY",
          message: `${getSourcePrefix(record.sourceLabel)}Cannot sell more than ${runningQuantity} units on ${record.date}.`,
        };
      }

      runningQuantity = Math.max(0, runningQuantity - record.quantity);
      continue;
    }

    if (record.type === "update") {
      runningQuantity = record.quantity;
    }
  }

  return { valid: true };
}
