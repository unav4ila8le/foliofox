"use server";

import { revalidatePath } from "next/cache";

import {
  ScenarioEvent,
  ScenarioInitialValueBasis,
  type ScenarioInitialValueBasis as ScenarioInitialValueBasisType,
} from "@/lib/scenario-planning/helpers";
import { resolveTodayDateKey } from "@/lib/date/date-utils";
import {
  ScenarioAssumptionsSchema,
  type ScenarioBaselineMetadata,
  withScenarioBaselineMetadata,
  withScenarioAssumptions,
} from "@/lib/scenario-planning/settings";
import { getCurrentUser } from "@/server/auth/actions";
import type { ActionResult } from "./types";
import type { Json } from "@/types/database.types";

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

  revalidatePath("/dashboard/planning/scenario");
  return { success: true };
}

/**
 * Update the initial value for a scenario.
 */
export async function updateScenarioInitialValue(
  scenarioId: string,
  initialValue: number,
  options?: {
    initialValueBasis?: ScenarioInitialValueBasisType;
  },
): Promise<ActionResult> {
  const { supabase, user } = await getCurrentUser();

  let initialValueBasis: ScenarioInitialValueBasisType | undefined;
  if (options?.initialValueBasis) {
    const parsedBasis = ScenarioInitialValueBasis.safeParse(
      options.initialValueBasis,
    );
    if (!parsedBasis.success) {
      return {
        success: false,
        code: "INVALID_INITIAL_VALUE_BASIS",
        message: "Invalid initial value basis",
      };
    }
    initialValueBasis = parsedBasis.data;
  }

  let updatedSettings: Json | undefined;

  if (initialValueBasis) {
    const { data: scenario, error: scenarioError } = await supabase
      .from("financial_scenarios")
      .select("settings")
      .eq("id", scenarioId)
      .eq("user_id", user.id)
      .single();

    if (!scenario || scenarioError) {
      return {
        success: false,
        code: scenarioError?.code || "NOT_FOUND",
        message: scenarioError?.message || "Scenario not found",
      };
    }

    let baselineMetadata: ScenarioBaselineMetadata | undefined;

    if (initialValueBasis !== "manual") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_currency,time_zone")
        .eq("user_id", user.id)
        .single();

      if (!profile || profileError) {
        return {
          success: false,
          code: profileError?.code || "PROFILE_NOT_FOUND",
          message:
            profileError?.message ||
            "Unable to resolve profile for sync metadata",
        };
      }

      baselineMetadata = {
        sourceCurrency: profile.display_currency,
        sourceMode: initialValueBasis,
        sourceAsOfDateKey: resolveTodayDateKey(profile.time_zone),
      };
    }

    updatedSettings = withScenarioBaselineMetadata({
      settings: scenario.settings,
      baseline: baselineMetadata,
    }) as Json;
  }

  const updatePayload: {
    initial_value: number;
    initial_value_basis?: ScenarioInitialValueBasisType;
    settings?: Json;
  } = {
    initial_value: initialValue,
  };
  if (initialValueBasis) {
    updatePayload.initial_value_basis = initialValueBasis;
  }
  if (updatedSettings !== undefined) {
    updatePayload.settings = updatedSettings;
  }

  const { error: updateError } = await supabase
    .from("financial_scenarios")
    .update(updatePayload)
    .eq("id", scenarioId)
    .eq("user_id", user.id);

  if (updateError) {
    return {
      success: false,
      code: updateError.code,
      message: updateError.message,
    };
  }

  revalidatePath("/dashboard/planning/scenario");
  return { success: true };
}

/**
 * Update scenario-global assumptions used by all planning views.
 */
export async function updateScenarioAssumptions(
  scenarioId: string,
  assumptionsData: unknown,
): Promise<ActionResult> {
  const { supabase, user } = await getCurrentUser();

  let assumptions;
  try {
    assumptions = ScenarioAssumptionsSchema.parse(assumptionsData);
  } catch {
    return {
      success: false,
      code: "INVALID_SCENARIO_ASSUMPTIONS",
      message: "Invalid scenario assumptions",
    };
  }

  const { data: scenario, error: fetchError } = await supabase
    .from("financial_scenarios")
    .select("settings")
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

  const updatedSettings = withScenarioAssumptions({
    settings: scenario.settings,
    assumptions,
  });

  const { error: updateError } = await supabase
    .from("financial_scenarios")
    .update({
      settings: updatedSettings as Json,
    })
    .eq("id", scenarioId)
    .eq("user_id", user.id);

  if (updateError) {
    return {
      success: false,
      code: updateError.code,
      message: updateError.message,
    };
  }

  revalidatePath("/dashboard/planning/scenario");
  return { success: true };
}
