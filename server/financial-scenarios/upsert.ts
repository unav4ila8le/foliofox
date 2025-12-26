"use server";

import { revalidatePath } from "next/cache";

import { ScenarioEvent } from "@/lib/scenario-planning/helpers";
import { getCurrentUser } from "@/server/auth/actions";
import type { Json } from "@/types/database.types";

interface ActionResult {
  success: boolean;
  code?: string;
  message?: string;
}

/**
 * Create or update an event in a scenario.
 * If eventIndex is provided, updates the event at that index.
 * Otherwise, appends a new event to the scenario.
 */
export async function upsertScenarioEvent(
  scenarioId: string,
  eventData: unknown,
  eventIndex?: number,
): Promise<ActionResult> {
  const { supabase, user } = await getCurrentUser();

  // Validate event data with Zod
  let event;
  try {
    event = ScenarioEvent.parse(eventData);
  } catch {
    return {
      success: false,
      code: "INVALID_EVENT",
      message: "Invalid event data",
    };
  }

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

  // Parse events array (handle both {} and [] defaults)
  const currentEvents = Array.isArray(scenario.events) ? scenario.events : [];

  // Update or append event
  const updatedEvents =
    eventIndex !== undefined
      ? currentEvents.map((e, i) => (i === eventIndex ? event : e))
      : [...currentEvents, event];

  // Update database
  const { error: updateError } = await supabase
    .from("financial_scenarios")
    .update({ events: updatedEvents as Json })
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

/**
 * Update the initial balance for a scenario.
 */
export async function updateScenarioInitialBalance(
  scenarioId: string,
  initialBalance: number,
): Promise<ActionResult> {
  const { supabase, user } = await getCurrentUser();

  const { error: updateError } = await supabase
    .from("financial_scenarios")
    .update({ initial_balance: initialBalance })
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
