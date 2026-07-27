import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSymbolReviewDigestEmail } from "./template";

import type { DigestEntry } from "./helpers";

function createEntry(overrides: Partial<DigestEntry> = {}): DigestEntry {
  return {
    symbolId: "11111111-1111-1111-1111-111111111111",
    aliasId: "22222222-2222-2222-2222-222222222222",
    aliasValue: "CFLT",
    displayName: "Confluent, Inc.",
    exchange: "NASDAQ",
    verdict: "retired",
    confidence: "high",
    summary: "Acquired and delisted in June 2026.",
    evidenceUrls: ["https://example.com/notice"],
    successorTicker: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://test.foliofox.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildSymbolReviewDigestEmail", () => {
  it("renders the retirement SQL into both html and text", async () => {
    const { html, text } = await buildSymbolReviewDigestEmail([createEntry()]);

    for (const output of [html, text]) {
      expect(output).toContain(
        "UPDATE symbol_aliases SET effective_to = now()",
      );
      expect(output).toContain("22222222-2222-2222-2222-222222222222");
    }
  });

  it("escapes LLM-authored text", async () => {
    const { html } = await buildSymbolReviewDigestEmail([
      createEntry({ summary: "<script>alert('x')</script>" }),
    ]);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("gives renamed verdicts the successor and playbook, but no SQL", async () => {
    const { html } = await buildSymbolReviewDigestEmail([
      createEntry({ verdict: "renamed", successorTicker: "NEWT" }),
    ]);

    expect(html).toContain("NEWT");
    expect(html).toContain("SYMBOL-RENAME-HANDLING.md");
    expect(html).not.toContain("UPDATE symbol_aliases");
  });

  it("gives other non-retired verdicts no SQL", async () => {
    const { html } = await buildSymbolReviewDigestEmail([
      createEntry({ verdict: "provider_issue" }),
      createEntry({ verdict: "thinly_traded" }),
      createEntry({ verdict: "unknown" }),
    ]);

    expect(html).not.toContain("UPDATE symbol_aliases");
  });

  it("carries no unsubscribe or preference chrome — this is operator mail", async () => {
    const { html } = await buildSymbolReviewDigestEmail([createEntry()]);

    expect(html).not.toContain("Unsubscribe");
    expect(html).not.toContain("Manage email settings");
  });
});

describe("operator layout", () => {
  it("does not end on a dangling divider", async () => {
    const { html } = await buildSymbolReviewDigestEmail([createEntry()]);
    const lastDivider = html.lastIndexOf("<hr");
    const lastContent = html.lastIndexOf("</pre>");

    expect(lastContent).toBeGreaterThan(-1);
    expect(lastDivider).toBeLessThan(lastContent);
  });
});
