import { describe, expect, it } from "vitest";

import {
  detectBrokerTransactionAdapter,
  parseBrokerTransactionsCSV,
} from "./registry";

const SCALABLE_HEADER =
  "date;description;type;isin;shares;price;amount;fee;tax;currency";

describe("Scalable Capital broker transaction adapter", () => {
  it("detects Scalable Capital transaction exports by header shape", () => {
    const adapter = detectBrokerTransactionAdapter(`${SCALABLE_HEADER}
2026-05-05;World ETF;Buy;LU0000000001;2;11,198;-22,396;0,99;0,00;EUR`);

    expect(adapter?.source).toBe("scalable_capital");
  });

  it("normalizes buy, sell, and savings plan rows with EU number formats", async () => {
    const csv = `${SCALABLE_HEADER}
2026-05-13;World ETF;Savings plan;LU0000000001;3,140309;159,22;-499,99999898;0,00;0,00;EUR
2026-05-05;World ETF;Buy;LU0000000001;2;11,198;-22,396;0,99;0,00;EUR
2026-05-04;Oil ETC;Sell;JE0000000001;1;77,995;77,995;0,99;0,00;EUR`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.source).toBe("scalable_capital");
    expect(result.positions).toHaveLength(2);
    expect(result.positions[0]).toMatchObject({
      name: "World ETF",
      category_id: "other",
      currency: "EUR",
      brokerSymbol: "LU0000000001",
      earliestTradeDate: "2026-05-05",
      firstUnitValue: 11.198,
      endingQuantity: 5.140309,
    });
    expect(result.records).toEqual([
      expect.objectContaining({
        type: "buy",
        date: "2026-05-13",
        quantity: 3.140309,
        unit_value: 159.22,
      }),
      expect.objectContaining({
        type: "buy",
        date: "2026-05-05",
        quantity: 2,
        unit_value: 11.198,
      }),
      expect.objectContaining({
        type: "sell",
        date: "2026-05-04",
        quantity: 1,
        unit_value: 77.995,
      }),
    ]);
    expect(
      result.warnings?.some((warning) => warning.includes("fee/tax")),
    ).toBe(true);
  });

  it("ignores deposits and other non-trade rows with a warning", async () => {
    const csv = `${SCALABLE_HEADER}
2026-05-11;Savings plan deposit;Deposit;;;;500,00;0,00;;EUR
2026-05-05;World ETF;Buy;LU0000000001;2;11,198;-22,396;0,00;0,00;EUR`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.ignoredRowCount).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(
      result.warnings?.some((warning) => warning.includes("non-trade")),
    ).toBe(true);
  });

  it("builds deterministic synthetic transaction IDs across re-uploads", async () => {
    const csv = `${SCALABLE_HEADER}
2026-05-05;World ETF;Buy;LU0000000001;2;11,198;-22,396;0,00;0,00;EUR
2026-05-05;World ETF;Buy;LU0000000001;2;11,198;-22,396;0,00;0,00;EUR`;

    const first = await parseBrokerTransactionsCSV(csv);
    const second = await parseBrokerTransactionsCSV(csv);

    const firstIds = first.records.map(
      (record) => record.external_transaction_id,
    );
    // Identical fills stay distinct via the occurrence suffix, while the same
    // file parsed again produces the same IDs so re-uploads skip them.
    expect(new Set(firstIds).size).toBe(2);
    expect(firstIds[0]).toBe("2026-05-05|LU0000000001|buy|2|11.198#1");
    expect(firstIds[1]).toBe("2026-05-05|LU0000000001|buy|2|11.198#2");
    expect(
      second.records.map((record) => record.external_transaction_id),
    ).toEqual(firstIds);
  });

  it("orders same-day trades chronologically in newest-first exports", async () => {
    const csv = `${SCALABLE_HEADER}
2026-05-05;World ETF;Sell;LU0000000001;2;12,00;24,00;0,00;0,00;EUR
2026-05-05;World ETF;Buy;LU0000000001;2;11,198;-22,396;0,00;0,00;EUR
2026-05-04;World ETF;Buy;LU0000000001;1;11,00;-11,00;0,00;0,00;EUR`;

    const result = await parseBrokerTransactionsCSV(csv);
    const [sell, buy] = result.records.filter(
      (record) => record.date === "2026-05-05",
    );

    // The sell appears first in the file but happened after the buy.
    expect(sell.executedAt! > buy.executedAt!).toBe(true);
  });
});
