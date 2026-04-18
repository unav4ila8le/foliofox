export const AUTOMATED_EMAIL_PREFERENCE_KEYS = {
  WEEKLY_RECAP: "weekly_recap_enabled",
  MARKETING_EMAILS: "marketing_emails_enabled",
} as const;

export type AutomatedEmailPreferenceKey =
  (typeof AUTOMATED_EMAIL_PREFERENCE_KEYS)[keyof typeof AUTOMATED_EMAIL_PREFERENCE_KEYS];

export const AUTOMATED_EMAIL_PREFERENCE_KEY_VALUES = Object.values(
  AUTOMATED_EMAIL_PREFERENCE_KEYS,
);

export const AUTOMATED_EMAIL_PREFERENCE_DETAILS = {
  weekly_recap_enabled: {
    label: "Weekly recap",
    reasonText:
      "You received this email because weekly recap emails are enabled in your Foliofox settings.",
  },
  marketing_emails_enabled: {
    label: "Marketing emails",
    reasonText:
      "You received this email because marketing emails are enabled in your Foliofox settings.",
  },
} as const satisfies Record<
  AutomatedEmailPreferenceKey,
  {
    label: string;
    reasonText: string;
  }
>;

export const DEFAULT_DIGEST_COMPARISON_DAYS = 7;
export const DEFAULT_TOP_MOVERS_LIMIT = 3;
export const DEFAULT_PROJECTED_INCOME_WINDOW_DAYS = 30;
export const DEFAULT_PROJECTED_INCOME_MONTHS_AHEAD = 2;
export const DEFAULT_UNSUBSCRIBE_TOKEN_TTL_DAYS = 30;
