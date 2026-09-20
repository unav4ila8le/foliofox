"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/server/auth/actions";
import { resolvePositionCategorySelection } from "@/server/positions/category-selection";
import {
  invalidTagInput,
  readTagAssignments,
  tagFailure,
  tagIdsSchema,
  validateTagTargets,
  writeTagAssignments,
} from "@/server/position-tags/utils";

import type {
  PositionSaveStep,
  UpdatePositionResult,
} from "@/server/position-tags/types";

const detailsSchema = z.object({
  name: z.string().min(3).max(64),
  category_id: z.string().min(1),
  user_category_id: z.union([z.uuid(), z.literal("")]).nullable(),
  description: z.string().max(256).nullable(),
  capital_gains_tax_rate: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(z.number().min(0).max(1).nullable())
    .optional(),
});

export async function updatePosition(
  formData: FormData,
  positionId: string,
): Promise<UpdatePositionResult> {
  const { supabase, user } = await getCurrentUser();
  const savedSteps: PositionSaveStep[] = [];
  let failedStep: "validation" | PositionSaveStep = "validation";
  let writeAttempted = false;

  try {
    // Validate all input before any write. An absent tag_ids preserves assignments.
    const parsedId = z.uuid().safeParse(positionId);
    const details = detailsSchema.safeParse({
      name: formData.get("name"),
      category_id: formData.get("category_id") || "other",
      user_category_id: formData.get("user_category_id"),
      description: formData.get("description"),
      capital_gains_tax_rate: formData.has("capital_gains_tax_rate")
        ? formData.get("capital_gains_tax_rate")
        : undefined,
    });
    if (!parsedId.success || !details.success) {
      return {
        ...invalidTagInput(
          details.success
            ? "Invalid position ID."
            : details.error.issues[0].message,
        ),
        failedStep,
        savedSteps,
      };
    }
    let requestedTagIds: string[] | undefined;
    if (formData.has("tag_ids")) {
      const rawTagIds = formData.get("tag_ids");
      try {
        if (
          typeof rawTagIds !== "string" ||
          formData.getAll("tag_ids").length !== 1
        )
          throw new Error();
        requestedTagIds = tagIdsSchema.parse(JSON.parse(rawTagIds));
      } catch {
        return {
          ...invalidTagInput("Tags must be a JSON array of UUIDs."),
          failedStep,
          savedSteps,
        };
      }
    }

    const { data: position, error: positionError } = await supabase
      .from("positions")
      .select("id, type")
      .eq("id", positionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (positionError) throw positionError;
    if (!position) throw { code: "NOT_FOUND", message: "Position not found." };

    const category = resolvePositionCategorySelection(formData);
    const categoryQuery = category.user_category_id
      ? supabase
          .from("user_position_categories")
          .select("id")
          .eq("id", category.user_category_id)
          .eq("user_id", user.id)
          .eq("position_type", position.type)
      : supabase
          .from("position_categories")
          .select("id")
          .eq("id", category.category_id)
          .eq("position_type", position.type);
    const { data: selectedCategory, error: categoryError } =
      await categoryQuery.maybeSingle();
    if (categoryError) throw categoryError;
    if (!selectedCategory)
      throw {
        code: "INVALID_CATEGORY",
        message: "The selected category is unavailable.",
      };

    let additions: string[] = [];
    let removals: string[] = [];
    if (requestedTagIds !== undefined) {
      if (position.type !== "asset")
        throw {
          code: "INVALID_TARGETS",
          message: "Tags can only be assigned to assets.",
        };
      await validateTagTargets(supabase, user.id, {
        positionIds: [],
        tagIds: requestedTagIds,
      });
      const assignments = await readTagAssignments(supabase, positionId);
      const current = new Set(
        assignments.map((assignment) => assignment.tag_id),
      );
      const requested = new Set(requestedTagIds);
      additions = requestedTagIds.filter((id) => !current.has(id));
      removals = [...current].filter((id) => !requested.has(id));
    }

    // Save details, then additions, then removals. Retrying reloads the delta above.
    failedStep = "details";
    writeAttempted = true;
    const { data: updated, error } = await supabase
      .from("positions")
      .update({
        name: details.data.name,
        ...category,
        description: details.data.description || null,
        ...(details.data.capital_gains_tax_rate !== undefined
          ? { capital_gains_tax_rate: details.data.capital_gains_tax_rate }
          : {}),
      })
      .eq("id", positionId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      writeAttempted = false;
      throw { code: "NOT_FOUND", message: "Position not found." };
    }
    savedSteps.push("details");

    if (additions.length) {
      failedStep = "tag_add";
      await writeTagAssignments(
        supabase,
        { positionIds: [positionId], tagIds: additions },
        "add",
      );
      savedSteps.push("tag_add");
    }
    if (removals.length) {
      failedStep = "tag_remove";
      await writeTagAssignments(
        supabase,
        { positionIds: [positionId], tagIds: removals },
        "remove",
      );
      savedSteps.push("tag_remove");
    }
    return { success: true };
  } catch (error) {
    const failure = tagFailure(error, { writeAttempted });
    if (savedSteps.length) {
      failure.message = `${savedSteps.includes("tag_add") ? "Details and tag additions were saved." : "Details were saved."} ${failure.message}`;
    }
    return { ...failure, failedStep, savedSteps };
  } finally {
    // Includes partial commits and ambiguous writes so refresh can reconcile them.
    if (writeAttempted || savedSteps.length)
      revalidatePath("/dashboard", "layout");
  }
}
