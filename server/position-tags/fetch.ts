"use server";

import { z } from "zod";

import { getCurrentUser } from "@/server/auth/actions";

import { readTagAssignments, readTagPages, validateTagTargets } from "./utils";
import type { PositionTag, PositionTagAssignment } from "./types";

export async function fetchPositionTags(): Promise<PositionTag[]> {
  const { supabase, user } = await getCurrentUser();
  return readTagPages((from, to) =>
    supabase
      .from("user_position_tags")
      .select("*")
      .eq("user_id", user.id)
      .order("name")
      .order("id")
      .range(from, to),
  );
}

export async function fetchPositionTagAssignments(
  positionId?: string,
): Promise<PositionTagAssignment[]> {
  const { supabase, user } = await getCurrentUser();
  if (positionId !== undefined) {
    z.uuid().parse(positionId);
    await validateTagTargets(supabase, user.id, {
      positionIds: [positionId],
      tagIds: [],
    });
  }
  return readTagAssignments(supabase, positionId);
}
