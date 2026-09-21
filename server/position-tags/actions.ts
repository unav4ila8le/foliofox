"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/server/auth/actions";
import { POSITION_TAG_COLORS } from "@/types/enums";

import {
  invalidTagInput,
  tagDetailsSchema,
  tagFailure,
  tagTargetsSchema,
  validateTagTargets,
  writeTagAssignments,
} from "./utils";
import type {
  PositionTagMutationResult,
  PositionTagTargets,
  PositionTagWriteResult,
} from "./types";

interface TagDetailsInput {
  name: string;
  color?: (typeof POSITION_TAG_COLORS)[number];
}

export async function createPositionTag(
  input: TagDetailsInput,
): Promise<PositionTagMutationResult> {
  const { supabase, user } = await getCurrentUser();
  const parsed = tagDetailsSchema
    .extend({ color: z.enum(POSITION_TAG_COLORS).default("blue") })
    .safeParse(input);
  if (!parsed.success) return invalidTagInput(parsed.error.issues[0].message);
  try {
    const { data, error } = await supabase
      .from("user_position_tags")
      .insert({ ...parsed.data, user_id: user.id })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/dashboard", "layout");
    return { success: true, tag: data };
  } catch (error) {
    revalidatePath("/dashboard", "layout");
    return tagFailure(error, { writeAttempted: true });
  }
}

export async function updatePositionTag(
  input: Required<TagDetailsInput> & { id: string },
): Promise<PositionTagMutationResult> {
  const { supabase, user } = await getCurrentUser();
  const parsed = tagDetailsSchema.extend({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return invalidTagInput(parsed.error.issues[0].message);
  const { id, ...details } = parsed.data;
  try {
    const { data, error } = await supabase
      .from("user_position_tags")
      .update(details)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return {
        success: false,
        code: "NOT_FOUND",
        message: "Tag not found.",
        outcomeUnknown: false,
      };
    revalidatePath("/dashboard", "layout");
    return { success: true, tag: data };
  } catch (error) {
    revalidatePath("/dashboard", "layout");
    return tagFailure(error, { writeAttempted: true });
  }
}

export async function deletePositionTag(
  id: string,
): Promise<PositionTagWriteResult> {
  const { supabase, user } = await getCurrentUser();
  if (!z.uuid().safeParse(id).success)
    return invalidTagInput("Invalid tag ID.");
  try {
    const { data, error } = await supabase
      .from("user_position_tags")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return {
        success: false,
        code: "NOT_FOUND",
        message: "Tag not found.",
        outcomeUnknown: false,
      };
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error) {
    revalidatePath("/dashboard", "layout");
    return tagFailure(error, { writeAttempted: true });
  }
}

async function changePositionTags(
  input: PositionTagTargets,
  operation: "add" | "remove",
): Promise<PositionTagWriteResult> {
  const { supabase, user } = await getCurrentUser();
  const parsed = tagTargetsSchema.safeParse(input);
  if (!parsed.success) return invalidTagInput(parsed.error.issues[0].message);
  let writeAttempted = false;
  try {
    await validateTagTargets(supabase, user.id, parsed.data);
    if (!parsed.data.tagIds.length) return { success: true };
    writeAttempted = true;
    await writeTagAssignments(supabase, parsed.data, operation);
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error) {
    if (writeAttempted) revalidatePath("/dashboard", "layout");
    return tagFailure(error, { writeAttempted });
  }
}

export async function addPositionTags(
  input: PositionTagTargets,
): Promise<PositionTagWriteResult> {
  return changePositionTags(input, "add");
}

export async function removePositionTags(
  input: PositionTagTargets,
): Promise<PositionTagWriteResult> {
  return changePositionTags(input, "remove");
}
