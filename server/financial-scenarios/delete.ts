"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

interface ActionResult {
  success: boolean;
  code?: string;
  message?: string;
}

/**
 * Delete an event from a scenario by its index.
 */
export async function deleteScenarioEvent(
  scenarioId: string,
  eventIndex: number,
): Promise<ActionResult> {
  const { supabase, user } = await getCurrentUser();

  // Fetch current scenario
  const { data: scenario, error: fetchError } = await supabase
    .from("financial_scenarios")
    .select("events")
    .eq("id", scenarioId)
    .eq("user_id", user.id)
    .single();

  if (!scenario || fetchError) {
    return {
      success: false,
      code: fetchError?.code || "NOT_FOUND",
      message: fetchError?.message || "Scenario not found",
    };
  }

  // Parse events array
  const currentEvents = Array.isArray(scenario.events) ? scenario.events : [];

  // Filter out event at index
  const updatedEvents = currentEvents.filter((_, i) => i !== eventIndex);

  // Update database
  const { error: updateError } = await supabase
    .from("financial_scenarios")
    .update({ events: updatedEvents })
    .eq("id", scenarioId)
    .eq("user_id", user.id);

  if (updateError) {
    return {
      success: false,
      code: updateError.code,
      message: updateError.message,
    };
  }

  revalidatePath("/dashboard/scenario-planning");
  return { success: true };
}
