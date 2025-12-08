"use server";

import { revalidatePath } from "next/cache";
import type { Scenario } from "@/lib/scenario-planning";
import {
  fromDatabaseScenarioToScenario,
  ScenarioEvent,
} from "@/lib/scenario-planning/helpers";
import { getCurrentUser } from "@/server/auth/actions";
import { Json } from "@/types/database.types";

export const get = async (): Promise<Scenario[]> => {
  const { supabase, user } = await getCurrentUser();

  const { error, data } = await supabase
    .from("financial_scenarios")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return data.map(fromDatabaseScenarioToScenario);
};

export const getOrCreateDefaultScenario = async (): Promise<
  Scenario & { id: string; initialBalance: number }
> => {
  const { supabase, user } = await getCurrentUser();

  // Fetch existing scenarios
  const { data: existingScenarios, error: fetchError } = await supabase
    .from("financial_scenarios")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  // If scenarios exist, return the first one
  if (existingScenarios && existingScenarios.length > 0) {
    const scenario = fromDatabaseScenarioToScenario(existingScenarios[0]);
    return {
      ...scenario,
      id: existingScenarios[0].id,
      initialBalance: existingScenarios[0].initial_balance,
    };
  }

  // Create default scenario
  const { data: newScenario, error: insertError } = await supabase
    .from("financial_scenarios")
    .insert({
      user_id: user.id,
      name: "My Scenario",
      events: [],
      engine_version: 1,
      initial_balance: 0,
    })
    .select()
    .single();

  if (!newScenario || insertError) {
    throw new Error(
      insertError?.message || "Failed to create default scenario",
    );
  }

  const scenario = fromDatabaseScenarioToScenario(newScenario);
  return {
    ...scenario,
    id: newScenario.id,
    initialBalance: newScenario.initial_balance,
  };
};

export const upsertEvent = async (
  scenarioId: string,
  eventData: unknown,
  eventIndex?: number,
): Promise<{ success: boolean; code?: string; message?: string }> => {
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
};

export const deleteEvent = async (
  scenarioId: string,
  eventIndex: number,
): Promise<{ success: boolean; code?: string; message?: string }> => {
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
};

export const updateInitialBalance = async (
  scenarioId: string,
  initialBalance: number,
): Promise<{ success: boolean; code?: string; message?: string }> => {
  const { supabase, user } = await getCurrentUser();

  // Update database
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
};
