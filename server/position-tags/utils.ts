import { z } from "zod";

import type { createClient } from "@/supabase/server";
import { POSITION_TAG_COLORS } from "@/types/enums";

import type { PositionTagFailure, PositionTagTargets } from "./types";

type Client = Awaited<ReturnType<typeof createClient>>;
interface QueryError {
  code?: string;
  message: string;
}

export const tagIdsSchema = z
  .array(z.uuid())
  .transform((ids) => [...new Set(ids)]);
export const tagDetailsSchema = z.object({
  name: z.string().trim().min(1).max(64),
  color: z.enum(POSITION_TAG_COLORS),
});
export const tagTargetsSchema = z.object({
  positionIds: tagIdsSchema.refine(
    (ids) => ids.length > 0,
    "Select at least one asset.",
  ),
  tagIds: tagIdsSchema,
});

export function tagFailure(
  error: unknown,
  { writeAttempted = false } = {},
): PositionTagFailure {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  const message =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : "Unable to complete the tag operation.";
  // A SQLSTATE reports a rejected database statement. Fetch/HTTP failures may
  // lose the response after a commit, so they must not imply a rollback.
  const outcomeUnknown = writeAttempted && !/^[0-9A-Z]{5}$/.test(code);
  return {
    success: false,
    code: code === "23505" ? "DUPLICATE_NAME" : code || "REQUEST_FAILED",
    message:
      code === "23505"
        ? "A tag with this name already exists."
        : outcomeUnknown
          ? "The save outcome is unknown. Refresh saved state before retrying."
          : message,
    outcomeUnknown,
  };
}

export function invalidTagInput(message: string): PositionTagFailure {
  return {
    success: false,
    code: "INVALID_INPUT",
    message,
    outcomeUnknown: false,
  };
}

// Keep pagination local to the tag feature; every caller supplies a stable order.
export async function readTagPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: QueryError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function validateTagTargets(
  supabase: Client,
  userId: string,
  { positionIds, tagIds }: PositionTagTargets,
) {
  const [positions, tags] = await Promise.all([
    positionIds.length
      ? readTagPages((from, to) =>
          supabase
            .from("positions")
            .select("id")
            .eq("user_id", userId)
            .eq("type", "asset")
            .in("id", positionIds)
            .order("id")
            .range(from, to),
        )
      : [],
    tagIds.length
      ? readTagPages((from, to) =>
          supabase
            .from("user_position_tags")
            .select("id")
            .eq("user_id", userId)
            .in("id", tagIds)
            .order("id")
            .range(from, to),
        )
      : [],
  ]);
  if (
    positions.length !== positionIds.length ||
    tags.length !== tagIds.length
  ) {
    throw {
      code: "INVALID_TARGETS",
      message:
        "One or more assets or tags are unavailable or do not belong to you.",
    };
  }
}

export async function readTagAssignments(
  supabase: Client,
  positionId?: string,
) {
  return readTagPages((from, to) => {
    let query = supabase
      .from("position_tag_assignments")
      .select("position_id, tag_id")
      .order("position_id")
      .order("tag_id");
    if (positionId) query = query.eq("position_id", positionId);
    return query.range(from, to);
  });
}

// Call only after validating the complete target set. Each operation is one write.
export async function writeTagAssignments(
  supabase: Client,
  { positionIds, tagIds }: PositionTagTargets,
  operation: "add" | "remove",
) {
  if (!positionIds.length || !tagIds.length) return;
  const { error } =
    operation === "add"
      ? await supabase.from("position_tag_assignments").upsert(
          positionIds.flatMap((position_id) =>
            tagIds.map((tag_id) => ({ position_id, tag_id })),
          ),
          { onConflict: "position_id,tag_id", ignoreDuplicates: true },
        )
      : await supabase
          .from("position_tag_assignments")
          .delete()
          .in("position_id", positionIds)
          .in("tag_id", tagIds);
  if (error) throw error;
}
