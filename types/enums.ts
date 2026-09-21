// Centralized, hardcoded enums for the app (positions-first architecture)
// Re-exported from database types with preferred naming conventions

import { Constants } from "@/types/database.types";

// Text CHECK values are not included in generated database enums.
export const POSITION_TAG_COLORS = [
  "neutral",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const;

// Portfolio record types
export const PORTFOLIO_RECORD_TYPES =
  Constants.public.Enums.portfolio_record_type;

// Risk preference types
export const RISK_PREFERENCES = Constants.public.Enums.risk_preference;

// Age band types
export const AGE_BANDS = Constants.public.Enums.age_band;

// Scenario planning starting value basis
export const SCENARIO_INITIAL_VALUE_BASES =
  Constants.public.Enums.scenario_initial_value_basis;
