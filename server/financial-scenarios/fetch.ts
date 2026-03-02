"use server";

import { cache } from "react";

import type { Scenario } from "@/lib/scenario-planning";
import { convertCurrency } from "@/lib/currency-conversion";
import { parseUTCDateKey, resolveTodayDateKey } from "@/lib/date/date-utils";
import {
  fromDatabaseScenarioToScenario,
  type ScenarioInitialValueBasis as ScenarioInitialValueBasisType,
} from "@/lib/scenario-planning/helpers";
import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import { getCurrentUser } from "@/server/auth/actions";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { fetchPositions } from "@/server/positions/fetch";
import { fetchProfile } from "@/server/profile/actions";

import type { TransformedPosition } from "@/types/global.types";

interface ScenarioStartingValueSuggestion {
  value: number;
  currency: string;
}

export interface ScenarioStartingValueSuggestions {
  cash: ScenarioStartingValueSuggestion | null;
  netWorth: ScenarioStartingValueSuggestion | null;
}

export interface ScenarioWithStartingValue extends Scenario {
  id: string;
  initialValue: number;
  initialValueBasis: ScenarioInitialValueBasisType;
}

const toSuggestion = (
  value: number,
  currency: string,
): ScenarioStartingValueSuggestion | null => {
  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    value,
    currency,
  };
};

const calculateTotalPositionValueInCurrency = async (input: {
  positions: TransformedPosition[];
  targetCurrency: string;
  asOfDate: Date;
}) => {
  const { positions, targetCurrency, asOfDate } = input;

  if (positions.length === 0) {
    return 0;
  }

  const uniqueCurrencies = new Set<string>();
  positions.forEach((position) => uniqueCurrencies.add(position.currency));
  uniqueCurrencies.add(targetCurrency);

  const exchangeRates = await fetchExchangeRates(
    Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date: asOfDate,
    })),
  );

  return positions.reduce((total, position) => {
    const convertedValue = convertCurrency(
      position.total_value,
      position.currency,
      targetCurrency,
      exchangeRates,
      asOfDate,
    );
    return total + convertedValue;
  }, 0);
};

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
 * Returns the scenario with its database ID and initial value.
 */
export const fetchOrCreateDefaultScenario = cache(
  async (): Promise<ScenarioWithStartingValue> => {
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
        initialValue: existingScenarios[0].initial_value,
        initialValueBasis: existingScenarios[0].initial_value_basis,
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
        initial_value: 0,
        initial_value_basis: "net_worth",
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
      initialValue: newScenario.initial_value,
      initialValueBasis: newScenario.initial_value_basis,
    };
  },
);

export const fetchScenarioStartingValueSuggestions = cache(
  async (targetCurrency: string): Promise<ScenarioStartingValueSuggestions> => {
    // 1. Align scenario defaults with the same civil "today" used in dashboard analytics.
    const { profile } = await fetchProfile();
    const asOfDateKey = resolveTodayDateKey(profile.time_zone);
    const asOfDate = parseUTCDateKey(asOfDateKey);

    try {
      const [netWorthValue, assetPositions] = await Promise.all([
        calculateNetWorth(targetCurrency, asOfDateKey),
        fetchPositions({
          includeArchived: true,
          positionType: "asset",
          asOfDateKey,
        }),
      ]);

      const cashPositions = assetPositions.filter(
        (position) => position.category_id === "cash",
      );
      const cashValue = await calculateTotalPositionValueInCurrency({
        positions: cashPositions,
        targetCurrency,
        asOfDate,
      });

      return {
        cash: toSuggestion(cashValue, targetCurrency),
        netWorth: toSuggestion(netWorthValue, targetCurrency),
      };
    } catch {
      return {
        cash: null,
        netWorth: null,
      };
    }
  },
);
