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
import type { SymbolReviewDigestEmailProps } from "@/emails/symbol-review-digest";

// Preview URLs point at the local Next.js dev server (port 3000). Run
// `npm run dev` alongside `npm run email:dev` so the logo image loads.
// The real cron path constructs these from NEXT_PUBLIC_SITE_URL at send
// time, so these values only matter for the local preview UI.
const previewLinks: AutomatedEmailTemplateLinks = {
  dashboardUrl: "http://localhost:3000/dashboard",
  settingsUrl: "http://localhost:3000/dashboard?settings=emails",
  unsubscribeUrl: "http://localhost:3000/unsubscribe?token=preview-token",
  logoUrl: "http://localhost:3000/images/foliofox-logo.png",
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

// Operator-only digest: no unsubscribe/settings links, so only the logo is
// needed. Covers one entry per verdict so the local preview exercises the SQL
// block, the rename playbook pointer, and the evidence list in one pass.
export const symbolReviewDigestPreviewProps: SymbolReviewDigestEmailProps = {
  logoUrl: previewLinks.logoUrl,
  entries: [
    {
      symbolId: "5f1c1d2e-0a3b-4c5d-8e9f-1a2b3c4d5e6f",
      aliasId: "9a8b7c6d-5e4f-4a3b-9c8d-7e6f5a4b3c2d",
      aliasValue: "CFLT",
      displayName: "Confluent, Inc.",
      exchange: "NASDAQ",
      verdict: "retired",
      confidence: "high",
      summary:
        "Confluent was acquired and its shares stopped trading on 30 June 2026. The ticker has since been reassigned to an unrelated ETF.",
      evidenceUrls: [
        "https://www.nasdaq.com/market-activity/stocks/cflt",
        "https://investors.confluent.io/news/acquisition-completed",
      ],
      successorTicker: null,
    },
    {
      symbolId: "1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7a8b",
      aliasId: "2c3d4e5f-6071-4829-ab3c-4d5e6f7a8b9c",
      aliasValue: "WBIT",
      displayName: "WisdomTree Bitcoin Fund",
      exchange: "CBOE",
      verdict: "renamed",
      confidence: "medium",
      summary:
        "The fund continued trading after a ticker change in May 2026. Quotes resume under the new symbol.",
      evidenceUrls: ["https://www.cboe.com/notices/2026/ticker-change"],
      successorTicker: "BTCW",
    },
    {
      symbolId: "3d4e5f60-7182-4930-bc4d-5e6f7a8b9c0d",
      aliasId: "4e5f6071-8293-4a41-cd5e-6f7a8b9c0d1e",
      aliasValue: "TLRY.TO",
      displayName: "Tilray Brands (Toronto)",
      exchange: "TSX",
      verdict: "provider_issue",
      confidence: "low",
      summary:
        "The listing is active and trading normally. The quote gap looks like a provider-side outage rather than a corporate action.",
      evidenceUrls: ["https://www.tsx.com/listings/tlry"],
      successorTicker: null,
    },
  ],
};
