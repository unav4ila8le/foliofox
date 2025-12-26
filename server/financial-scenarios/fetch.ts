"use server";

import { cache } from "react";

import type { Scenario } from "@/lib/scenario-planning";
import { fromDatabaseScenarioToScenario } from "@/lib/scenario-planning/helpers";
import { getCurrentUser } from "@/server/auth/actions";

/**
 * Fetch all financial scenarios for the current user.
 */
export const fetchScenarios = cache(async (): Promise<Scenario[]> => {
  const { supabase, user } = await getCurrentUser();

  const { error, data } = await supabase
    .from("financial_scenarios")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return data.map(fromDatabaseScenarioToScenario);
});

/**
 * Fetch the user's default scenario, creating one if none exists.
 * Returns the scenario with its database ID and initial balance.
 */
export const fetchOrCreateDefaultScenario = cache(
  async (): Promise<Scenario & { id: string; initialBalance: number }> => {
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
  },
);
