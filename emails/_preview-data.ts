import {
  AUTOMATED_EMAIL_PREFERENCE_DETAILS,
  AUTOMATED_EMAIL_PREFERENCE_KEYS,
} from "@/server/automated-emails/constants";
import { toCivilDateKeyOrThrow } from "@/lib/date/date-utils";

import type { AutomatedEmailDigest } from "@/server/automated-emails/digest";
import type {
  AutomatedEmailTemplateLinks,
  AutomatedEmailTemplateProps,
} from "@/emails/types";

const previewLinks: AutomatedEmailTemplateLinks = {
  dashboardUrl: "https://www.foliofox.com/dashboard",
  settingsUrl: "https://www.foliofox.com/dashboard?settings=emails",
  unsubscribeUrl: "https://www.foliofox.com/unsubscribe?token=preview-token",
};

const previewDigest: AutomatedEmailDigest = {
  userId: "preview-user",
  currency: "USD",
  activePositionCount: 7,
  netWorth: {
    asOfDateKey: toCivilDateKeyOrThrow("2026-04-17"),
    comparisonDateKey: toCivilDateKeyOrThrow("2026-04-10"),
    currentValue: 128450,
    previousValue: 123900,
    absoluteChange: 4550,
    percentageChange: 3.6723163841807907,
  },
  topMovers: {
    analyzed: 7,
    gainers: [
      {
        asset: {
          id: "nvda",
          name: "NVIDIA",
          symbol: "NVDA",
          category: "Stocks",
          currency: "USD",
          isArchived: false,
        },
        startValue: 18200,
        endValue: 20140,
        priceReturnPct: 10.7,
        valueChangeAbs: 1940,
        valueChangePct: 10.7,
        partialPeriod: false,
      },
      {
        asset: {
          id: "msft",
          name: "Microsoft",
          symbol: "MSFT",
          category: "Stocks",
          currency: "USD",
          isArchived: false,
        },
        startValue: 14100,
        endValue: 14910,
        priceReturnPct: 5.7,
        valueChangeAbs: 810,
        valueChangePct: 5.7,
        partialPeriod: false,
      },
    ],
    losers: [
      {
        asset: {
          id: "goog",
          name: "Alphabet",
          symbol: "GOOGL",
          category: "Stocks",
          currency: "USD",
          isArchived: false,
        },
        startValue: 11820,
        endValue: 11230,
        priceReturnPct: -5,
        valueChangeAbs: -590,
        valueChangePct: -5,
        partialPeriod: false,
      },
    ],
  },
  projectedIncome: {
    currency: "USD",
    windowDays: 30,
    monthsAhead: 2,
    windowEstimate: 260,
    monthlySeries: [
      {
        date: new Date(Date.UTC(2026, 3, 1)),
        income: 180,
      },
      {
        date: new Date(Date.UTC(2026, 4, 1)),
        income: 340,
      },
    ],
  },
};

export const weeklyRecapPreviewProps: AutomatedEmailTemplateProps = {
  username: "Leonardo",
  digest: previewDigest,
  links: previewLinks,
  reasonText:
    AUTOMATED_EMAIL_PREFERENCE_DETAILS[
      AUTOMATED_EMAIL_PREFERENCE_KEYS.WEEKLY_RECAP
    ].reasonText,
};

export const reengagementPreviewProps: AutomatedEmailTemplateProps = {
  username: "Leonardo",
  digest: previewDigest,
  links: previewLinks,
  reasonText:
    AUTOMATED_EMAIL_PREFERENCE_DETAILS[
      AUTOMATED_EMAIL_PREFERENCE_KEYS.MARKETING_EMAILS
    ].reasonText,
};
