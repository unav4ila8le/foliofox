import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

const generateTextMock = vi.fn();
const sendEmailMock = vi.fn();

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, generateText: generateTextMock };
});

vi.mock("@/server/automated-emails/sender", () => ({
  createAutomatedEmailSender: () => ({ sendEmail: sendEmailMock }),
}));

const { runSymbolReview } = await import("./worker");

interface StubResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

interface StubCall {
  table: string;
  operation: string;
  payload?: unknown;
}

/**
 * Minimal chainable Supabase stub: every builder method returns itself, and
 * awaiting resolves the next queued result for that `table:operation`.
 */
function createSupabaseStub(results: Record<string, StubResult[]>) {
  const calls: StubCall[] = [];

  const client = {
    from(table: string) {
      let operation = "select";
      let payload: unknown;

      const builder: Record<string, unknown> = {};
      const methods = [
        "select",
        "insert",
        "update",
        "eq",
        "is",
        "or",
        "lt",
        "gte",
        "not",
        "in",
        "order",
        "limit",
      ];

      methods.forEach((method) => {
        builder[method] = (...args: unknown[]) => {
          if (method === "insert" || method === "update") {
            operation = method;
            payload = args[0];
          }
          return builder;
        };
      });

      builder.then = (resolve: (value: StubResult) => unknown) => {
        calls.push({ table, operation, payload });
        const queued = results[`${table}:${operation}`]?.shift() ?? {};
        return Promise.resolve({
          data: null,
          error: null,
          count: null,
          ...queued,
        }).then(resolve);
      };

      return builder;
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    calls,
  };
}

const CANDIDATE_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  exchange: "NASDAQ",
  long_name: "Confluent, Inc.",
  short_name: "Confluent",
  currency: "USD",
  quote_type: "EQUITY",
  last_quote_at: "2026-06-01T00:00:00Z",
  positions: [{ id: "33333333-3333-3333-3333-333333333333" }],
  symbol_aliases: [
    { id: "22222222-2222-2222-2222-222222222222", value: "CFLT" },
  ],
};

// Mirrors the SDK shape: evidence comes from the web_search tool result's
// consulted-source list, not from `result.sources` (citation annotations,
// which a structured JSON output never produces).
function groundedResult() {
  return {
    output: {
      verdict: "retired",
      confidence: "high",
      summary: "Acquired and delisted.",
      successor_ticker: null,
    },
    sources: [],
    toolResults: [
      {
        toolName: "web_search",
        output: {
          action: { type: "search", queries: ["CFLT delisted"] },
          sources: [
            { type: "url", url: "https://x.dev/a" },
            { type: "api", name: "internal" },
          ],
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER_API_KEY", "test-key");
  vi.stubEnv("RESEND_API_KEY", "test-resend");
  vi.stubEnv("EMAILS_FROM_ADDRESS", "Foliofox <notify@foliofox.dev>");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://test.foliofox.com");
  sendEmailMock.mockResolvedValue({ provider: "resend", messageId: "1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("runSymbolReview configuration gate", () => {
  it.each(["AI_PROVIDER_API_KEY", "RESEND_API_KEY", "EMAILS_FROM_ADDRESS"])(
    "skips with no side effects when %s is missing",
    async (variable) => {
      vi.stubEnv(variable, "");
      const { client, calls } = createSupabaseStub({});

      const result = await runSymbolReview({ supabase: client });

      expect(result.skipped).toContain(variable);
      expect(calls).toHaveLength(0);
      expect(generateTextMock).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
    },
  );
});

describe("runSymbolReview verdict guards", () => {
  it("stores a grounded verdict and sends the digest", async () => {
    const { client, calls } = createSupabaseStub({
      "symbols:select": [{ data: [CANDIDATE_ROW], count: 1 }],
      "symbol_review_verdicts:select": [{ data: [] }, { data: [] }],
    });
    generateTextMock.mockResolvedValue(groundedResult());

    const result = await runSymbolReview({ supabase: client });

    expect(result.stats).toMatchObject({
      candidates: 1,
      reviewed: 1,
      failed: 0,
    });
    const insert = calls.find((call) => call.operation === "insert");
    expect(insert?.payload).toMatchObject({
      symbol_id: CANDIDATE_ROW.id,
      alias_id: "22222222-2222-2222-2222-222222222222",
      alias_value: "CFLT",
      evidence_urls: ["https://x.dev/a"],
    });
  });

  it("refuses to store a verdict when the search reported no sources", async () => {
    const { client, calls } = createSupabaseStub({
      "symbols:select": [{ data: [CANDIDATE_ROW], count: 1 }],
      "symbol_review_verdicts:select": [{ data: [] }, { data: [] }],
    });
    generateTextMock.mockResolvedValue({
      ...groundedResult(),
      toolResults: [
        { toolName: "web_search", output: { action: { type: "search" } } },
      ],
    });

    const result = await runSymbolReview({ supabase: client });

    expect(result.stats).toMatchObject({ reviewed: 0, failed: 1 });
    expect(calls.some((call) => call.operation === "insert")).toBe(false);
  });

  it("refuses to store a verdict when no web_search call ran", async () => {
    const { client, calls } = createSupabaseStub({
      "symbols:select": [{ data: [CANDIDATE_ROW], count: 1 }],
      "symbol_review_verdicts:select": [{ data: [] }, { data: [] }],
    });
    generateTextMock.mockResolvedValue({
      ...groundedResult(),
      toolResults: [],
    });

    const result = await runSymbolReview({ supabase: client });

    expect(result.stats).toMatchObject({ reviewed: 0, failed: 1 });
    expect(calls.some((call) => call.operation === "insert")).toBe(false);
  });

  it("counts a missing structured output as failed", async () => {
    const { client, calls } = createSupabaseStub({
      "symbols:select": [{ data: [CANDIDATE_ROW], count: 1 }],
      "symbol_review_verdicts:select": [{ data: [] }, { data: [] }],
    });
    // AI SDK 7 throws NoOutputGeneratedError from the getter rather than
    // returning undefined, so the mock has to throw to be realistic.
    generateTextMock.mockResolvedValue({
      ...groundedResult(),
      get output(): never {
        throw new Error("No output generated.");
      },
    });

    const result = await runSymbolReview({ supabase: client });

    expect(result.stats).toMatchObject({ reviewed: 0, failed: 1 });
    expect(calls.some((call) => call.operation === "insert")).toBe(false);
  });

  it("nulls successor_ticker unless the verdict is renamed", async () => {
    const { client, calls } = createSupabaseStub({
      "symbols:select": [{ data: [CANDIDATE_ROW], count: 1 }],
      "symbol_review_verdicts:select": [{ data: [] }, { data: [] }],
    });
    generateTextMock.mockResolvedValue({
      ...groundedResult(),
      output: {
        verdict: "provider_issue",
        confidence: "low",
        summary: "Yahoo gap.",
        successor_ticker: "STRAY",
      },
    });

    await runSymbolReview({ supabase: client });

    const insert = calls.find((call) => call.operation === "insert");
    expect(insert?.payload).toMatchObject({ successor_ticker: null });
  });

  it("steps over failures instead of spending the quota on them", async () => {
    // Failures never enter the cooldown set, so without the overfetch slack
    // the same head-of-queue rows would consume every slot week after week.
    const rows = [1, 2, 3, 4].map((index) => ({
      ...CANDIDATE_ROW,
      id: `1111111${index}-1111-1111-1111-111111111111`,
      symbol_aliases: [
        {
          id: `2222222${index}-2222-2222-2222-222222222222`,
          value: `T${index}`,
        },
      ],
    }));
    const { client, calls } = createSupabaseStub({
      "symbols:select": [{ data: rows, count: 4 }],
      "symbol_review_verdicts:select": [{ data: [] }, { data: [] }],
    });
    generateTextMock
      .mockResolvedValueOnce({ ...groundedResult(), toolResults: [] })
      .mockResolvedValue(groundedResult());

    const result = await runSymbolReview({ supabase: client, maxSymbols: 2 });

    expect(result.stats).toMatchObject({ reviewed: 2, failed: 1 });
    // Third and fourth rows: one reviewed to fill the quota, one left for
    // next week rather than reviewed for free.
    expect(generateTextMock).toHaveBeenCalledTimes(3);
    expect(
      calls
        .filter((call) => call.operation === "insert")
        .map((call) => (call.payload as { alias_value: string }).alias_value),
    ).toEqual(["T2", "T3"]);
  });

  it("skips a symbol without exactly one active Yahoo alias", async () => {
    const { client } = createSupabaseStub({
      "symbols:select": [
        { data: [{ ...CANDIDATE_ROW, symbol_aliases: [] }], count: 1 },
      ],
      "symbol_review_verdicts:select": [{ data: [] }, { data: [] }],
    });

    const result = await runSymbolReview({ supabase: client });

    expect(result.stats.candidates).toBe(0);
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});

describe("runSymbolReview digest delivery", () => {
  const pendingRow = {
    id: "44444444-4444-4444-4444-444444444444",
    symbol_id: CANDIDATE_ROW.id,
    alias_id: "22222222-2222-2222-2222-222222222222",
    alias_value: "CFLT",
    verdict: "retired",
    confidence: "high",
    summary: "Acquired and delisted.",
    evidence_urls: ["https://x.dev/a"],
    successor_ticker: null,
    symbols: {
      exchange: "NASDAQ",
      long_name: "Confluent, Inc.",
      short_name: "Confluent",
    },
  };

  it("marks rows emailed only after a successful send", async () => {
    const { client, calls } = createSupabaseStub({
      "symbols:select": [{ data: [], count: 0 }],
      "symbol_review_verdicts:select": [{ data: [] }, { data: [pendingRow] }],
    });

    const result = await runSymbolReview({ supabase: client });

    expect(result.stats.digestsSent).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "notify@foliofox.dev" }),
    );
    expect(calls.some((call) => call.operation === "update")).toBe(true);
  });

  it("leaves rows pending when the send throws, without failing the run", async () => {
    const { client, calls } = createSupabaseStub({
      "symbols:select": [{ data: [], count: 0 }],
      "symbol_review_verdicts:select": [{ data: [] }, { data: [pendingRow] }],
    });
    sendEmailMock.mockRejectedValue(new Error("resend down"));

    const result = await runSymbolReview({ supabase: client });

    expect(result.success).toBe(true);
    expect(result.stats.digestsSent).toBe(0);
    expect(calls.some((call) => call.operation === "update")).toBe(false);
  });
});
