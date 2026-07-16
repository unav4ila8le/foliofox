import { describe, expect, it } from "vitest";

import {
  assignFileOrderExecutedAt,
  inferOpeningQuantity,
} from "./adapter-utils";

import type { BrokerTransactionRecordDraft } from "./types";

function record(
  overrides: Partial<BrokerTransactionRecordDraft>,
): BrokerTransactionRecordDraft {
  return {
    source: "scalable_capital",
    positionKey: "key",
    positionName: "World ETF",
    type: "buy",
    date: "2026-01-01",
    quantity: 1,
    unit_value: 10,
    description: null,
    external_transaction_id: "id",
    sourceRowNumber: 2,
    ...overrides,
  };
}

describe("assignFileOrderExecutedAt", () => {
  it("treats single-date files as newest-first", () => {
    // A same-day sell listed above its buy in a newest-first export happened
    // after the buy; keeping file order would fabricate an opening shortfall.
    const records = [
      record({ type: "sell", sourceRowNumber: 2 }),
      record({ type: "buy", sourceRowNumber: 3 }),
    ];

    assignFileOrderExecutedAt(records);

    expect(records[0].executedAt! > records[1].executedAt!).toBe(true);
  });
});

describe("inferOpeningQuantity", () => {
  it("returns zero for a self-contained buy/sell history", () => {
    expect(
      inferOpeningQuantity([
        record({ type: "buy", date: "2026-01-01", quantity: 5 }),
        record({ type: "sell", date: "2026-02-01", quantity: 5 }),
      ]),
    ).toBe(0);
  });

  it("covers a sell that has no buys in the export window", () => {
    expect(
      inferOpeningQuantity([
        record({ type: "sell", date: "2026-01-01", quantity: 3 }),
      ]),
    ).toBe(3);
  });

  it("covers the largest shortfall across an interleaved history", () => {
    // Chronologically: sell 2 (short 2), buy 5 (up 3), sell 4 (short 1 more
    // than covered → total shortfall stays 2). Records passed out of order to
    // prove sorting by date.
    expect(
      inferOpeningQuantity([
        record({ type: "sell", date: "2026-03-01", quantity: 4 }),
        record({ type: "buy", date: "2026-02-01", quantity: 5 }),
        record({ type: "sell", date: "2026-01-01", quantity: 2 }),
      ]),
    ).toBe(2);
  });
});
