import { describe, expect, it } from "vitest";

import {
  buildDigestSubject,
  buildRetirementSql,
  groupDigestEntries,
  resolveDigestRecipient,
  type DigestEntry,
} from "./helpers";

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

describe("resolveDigestRecipient", () => {
  it("prefers the explicit override", () => {
    expect(
      resolveDigestRecipient("ops@foliofox.dev", "Foliofox <no@x.dev>"),
    ).toBe("ops@foliofox.dev");
  });

  it("extracts the mailbox from a display-name from address", () => {
    expect(resolveDigestRecipient(undefined, "Foliofox <notify@x.dev>")).toBe(
      "notify@x.dev",
    );
  });

  it("passes a bare address through", () => {
    expect(resolveDigestRecipient("  ", " notify@x.dev ")).toBe("notify@x.dev");
  });
});

describe("buildRetirementSql", () => {
  it("scopes both statements by alias id, never by ticker value", () => {
    const sql = buildRetirementSql(createEntry());

    expect(sql).toContain(
      "WHERE id = '22222222-2222-2222-2222-222222222222' AND effective_to IS NULL",
    );
    expect(sql).toContain("UPDATE symbol_aliases SET effective_to = now()");
    // A value-scoped predicate would retire whichever security holds the
    // ticker at apply time, which is the bug this scoping exists to prevent.
    expect(sql).not.toContain("value = 'CFLT'");
  });
});

describe("groupDigestEntries", () => {
  it("orders groups most actionable first and drops empty ones", () => {
    const groups = groupDigestEntries([
      createEntry({ verdict: "unknown" }),
      createEntry({ verdict: "retired" }),
      createEntry({ verdict: "renamed", successorTicker: "NEWT" }),
    ]);

    expect(groups.map((group) => group.verdict)).toEqual([
      "retired",
      "renamed",
      "unknown",
    ]);
  });
});

describe("buildDigestSubject", () => {
  it("singularises a one-symbol digest", () => {
    expect(buildDigestSubject([createEntry()])).toContain("1 stale symbol ");
    expect(buildDigestSubject([createEntry(), createEntry()])).toContain(
      "2 stale symbols ",
    );
  });
});
