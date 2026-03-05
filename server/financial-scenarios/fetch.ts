"use server";

import { cache } from "react";

import { convertCurrency } from "@/lib/currency-conversion";
import { parseUTCDateKey, resolveTodayDateKey } from "@/lib/date/date-utils";
import type { Scenario } from "@/lib/planning/scenario/engine";
import { fromDatabaseScenarioToScenario } from "@/lib/planning/scenario/helpers";
import type { ScenarioInitialValueBasis } from "@/lib/planning/initial-value-basis";
import type { ScenarioInitialValueSuggestions } from "@/lib/planning/initial-value";
import {
  fromDatabaseScenarioSettings,
  getDefaultScenarioSettings,
  toDatabaseScenarioSettings,
  type ScenarioAssumptions,
  type ScenarioSettings,
} from "@/lib/planning/settings";
import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import { getCurrentUser } from "@/server/auth/actions";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { fetchPositions } from "@/server/positions/fetch";
import { fetchProfile } from "@/server/profile/actions";

import type {
  FinancialScenario,
  TransformedPosition,
} from "@/types/global.types";

export interface ScenarioWithInitialValue extends Scenario {
  id: string;
  initialValue: number;
  initialValueBasis: ScenarioInitialValueBasis;
  settings: ScenarioSettings;
  assumptions: ScenarioAssumptions;
}

const toSuggestion = (
  value: number,
  currency: string,
): ScenarioInitialValueSuggestions["cash"] => {
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

const toScenarioWithInitialValue = (
  databaseScenario: FinancialScenario,
): ScenarioWithInitialValue => {
  const scenario = fromDatabaseScenarioToScenario(databaseScenario);
  const settings = fromDatabaseScenarioSettings(databaseScenario.settings);

  return {
    ...scenario,
    id: databaseScenario.id,
    initialValue: databaseScenario.initial_value,
    initialValueBasis: databaseScenario.initial_value_basis,
    settings,
    assumptions: settings.assumptions,
  };
};

/**
 * Fetch the user's default scenario, creating one if none exists.
 * Returns the scenario with its database ID and initial value.
 */
export const fetchOrCreateDefaultScenario = cache(
  async (): Promise<ScenarioWithInitialValue> => {
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
      return toScenarioWithInitialValue(existingScenarios[0]);
    }

    // Create default scenario
    const defaultSettings = getDefaultScenarioSettings();
    const { data: newScenario, error: insertError } = await supabase
      .from("financial_scenarios")
      .insert({
        user_id: user.id,
        name: "My Scenario",
        events: [],
        engine_version: 1,
        initial_value: 0,
        initial_value_basis: "net_worth",
        settings: toDatabaseScenarioSettings(defaultSettings),
      })
      .select()
      .single();

    if (!newScenario || insertError) {
      throw new Error(
        insertError?.message || "Failed to create default scenario",
      );
    }

    return toScenarioWithInitialValue(newScenario);
  },
);

export const fetchScenarioInitialValueSuggestions = cache(
  async (targetCurrency: string): Promise<ScenarioInitialValueSuggestions> => {
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
