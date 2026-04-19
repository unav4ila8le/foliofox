import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AUTOMATED_EMAIL_PREFERENCE_DETAILS } from "@/server/automated-emails/constants";
import { toCivilDateKeyOrThrow } from "@/lib/date/date-utils";

import type { AutomatedEmailDigest } from "@/server/automated-emails/digest";

const SITE_URL = "https://test.foliofox.com";

function buildSampleDigest(
  overrides?: Partial<AutomatedEmailDigest>,
): AutomatedEmailDigest {
  return {
    userId: "user-template-test",
    currency: "USD",
    activePositionCount: 2,
    netWorth: {
      asOfDateKey: toCivilDateKeyOrThrow("2026-04-20"),
      comparisonDateKey: toCivilDateKeyOrThrow("2026-04-13"),
      currentValue: 50000,
      previousValue: 48000,
      absoluteChange: 2000,
      percentageChange: 4.166,
    },
    topMovers: {
      analyzed: 2,
      gainers: [
        {
          asset: {
            id: "asset-gain",
            name: "Apple",
            symbol: "AAPL",
            category: "Stocks",
            currency: "USD",
            isArchived: false,
          },
          startValue: 1000,
          endValue: 1100,
          priceReturnPct: 10,
          valueChangeAbs: 100,
          valueChangePct: 10,
          partialPeriod: false,
        },
      ],
      losers: [
        {
          asset: {
            id: "asset-loss",
            name: "Tesla",
            symbol: "TSLA",
            category: "Stocks",
            currency: "USD",
            isArchived: false,
          },
          startValue: 1000,
          endValue: 950,
          priceReturnPct: -5,
          valueChangeAbs: -50,
          valueChangePct: -5,
          partialPeriod: false,
        },
      ],
    },
    projectedIncome: {
      currency: "USD",
      windowDays: 30,
      monthsAhead: 2,
      windowEstimate: 320,
      monthlySeries: [
        { date: new Date(Date.UTC(2026, 3, 1)), income: 200 },
        { date: new Date(Date.UTC(2026, 4, 1)), income: 440 },
      ],
    },
    ...overrides,
  };
}

describe("automated email templates", () => {
  beforeEach(() => {
    process.env.EMAIL_LINK_SECRET = "test-template-secret";
    process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
  });

  afterEach(() => {
    delete process.env.EMAIL_LINK_SECRET;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("renders the weekly recap with HTML, plain text, and footer links pointing at the weekly_recap preference", async () => {
    const { buildWeeklyRecapEmailTemplate } = await import("./templates");
    const rendered = await buildWeeklyRecapEmailTemplate({
      userId: "user-weekly",
      username: "Alice",
      digest: buildSampleDigest(),
    });

    expect(rendered.subject).toBe("Your Foliofox weekly recap");

    expect(rendered.links.dashboardUrl).toBe(`${SITE_URL}/dashboard`);
    expect(rendered.links.settingsUrl).toBe(
      `${SITE_URL}/dashboard?settings=emails`,
    );
    expect(
      rendered.links.unsubscribeUrl.startsWith(
        `${SITE_URL}/unsubscribe?token=`,
      ),
    ).toBe(true);

    expect(rendered.html.length).toBeGreaterThan(0);
    expect(rendered.text.length).toBeGreaterThan(0);

    for (const output of [rendered.html, rendered.text]) {
      expect(output).toContain(rendered.links.dashboardUrl);
      expect(output).toContain(rendered.links.settingsUrl);
      expect(output).toContain(rendered.links.unsubscribeUrl);
      expect(output).toContain(
        AUTOMATED_EMAIL_PREFERENCE_DETAILS.weekly_recap_enabled.reasonText,
      );
    }
  });

  it("renders the re-engagement email and routes its unsubscribe footer to the marketing_emails preference", async () => {
    const { buildReengagementEmailTemplate } = await import("./templates");
    const rendered = await buildReengagementEmailTemplate({
      userId: "user-reengagement",
      username: "Bob",
      digest: buildSampleDigest(),
    });

    expect(rendered.subject).toBe("A quick portfolio check-in from Foliofox");

    for (const output of [rendered.html, rendered.text]) {
      expect(output).toContain(rendered.links.dashboardUrl);
      expect(output).toContain(rendered.links.settingsUrl);
      expect(output).toContain(rendered.links.unsubscribeUrl);
      expect(output).toContain(
        AUTOMATED_EMAIL_PREFERENCE_DETAILS.marketing_emails_enabled.reasonText,
      );
      // Defensive: the re-engagement email must never quote weekly recap
      // copy in its footer because the unsubscribe link only disables
      // marketing_emails_enabled.
      expect(output).not.toContain(
        AUTOMATED_EMAIL_PREFERENCE_DETAILS.weekly_recap_enabled.reasonText,
      );
    }
  });

  it("issues distinct unsubscribe tokens for the two preference categories", async () => {
    const { buildWeeklyRecapEmailTemplate, buildReengagementEmailTemplate } =
      await import("./templates");
    const digest = buildSampleDigest();

    const weekly = await buildWeeklyRecapEmailTemplate({
      userId: "user-distinct",
      username: "Carol",
      digest,
    });
    const reengagement = await buildReengagementEmailTemplate({
      userId: "user-distinct",
      username: "Carol",
      digest,
    });

    expect(weekly.links.unsubscribeUrl).not.toEqual(
      reengagement.links.unsubscribeUrl,
    );
  });
});
