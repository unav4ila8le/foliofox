// Centralized, hardcoded enums for the app (positions-first architecture)
// Re-exported from database types with preferred naming conventions

import { Constants } from "@/types/database.types";

// Portfolio record types
export const PORTFOLIO_RECORD_TYPES =
  Constants.public.Enums.portfolio_record_type;

// Position types (assets now; liabilities reserved for future)
export const POSITION_TYPES = Constants.public.Enums.position_type;

// Risk preference types
export const RISK_PREFERENCES = Constants.public.Enums.risk_preference;

// Age band types
export const AGE_BANDS = Constants.public.Enums.age_band;

// Automated email delivery types
export const AUTOMATED_EMAIL_TYPES =
  Constants.public.Enums.automated_email_type;

// Automated email delivery statuses
export const AUTOMATED_EMAIL_DELIVERY_STATUSES =
  Constants.public.Enums.automated_email_delivery_status;

// Scenario planning starting value basis
export const SCENARIO_INITIAL_VALUE_BASES =
  Constants.public.Enums.scenario_initial_value_basis;
