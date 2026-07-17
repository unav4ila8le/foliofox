import { describe, expect, it } from "vitest";

import {
  detectBrokerTransactionAdapter,
  parseBrokerTransactionsCSV,
} from "./registry";

const SCALABLE_HEADER =
  "date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency";

describe("Scalable Capital broker transaction adapter", () => {
  it("detects Scalable Capital transaction exports by header shape", () => {
    const adapter = detectBrokerTransactionAdapter(`${SCALABLE_HEADER}
2026-05-05;08:52:49;Executed;"SCAL1";"World ETF";Security;Buy;LU0000000001;2;11,198;-22,396;0,99;0,00;EUR`);

    expect(adapter?.source).toBe("scalable_capital");
  });

  it("detects stripped exports but rejects them with an actionable error", async () => {
    // Detection must still match column-stripped files so other import flows
    // can route them away from the positions importer; parsing rejects them.
    const csv = `date;description;type;isin;shares;price;amount;fee;tax;currency
2026-05-05;World ETF;Buy;LU0000000001;2;11,198;-22,396;0,99;0,00;EUR`;

    expect(detectBrokerTransactionAdapter(csv)?.source).toBe(
      "scalable_capital",
    );

    const result = await parseBrokerTransactionsCSV(csv);
    expect(result.success).toBe(false);
    expect(
      result.errors?.some((error) => error.includes("edited after export")),
    ).toBe(true);
  });

  it("falls back to file-order ordering when a time is out of range", async () => {
    // "99:99:99" matches the shape regex but builds an Invalid Date; it must
    // not crash the parse.
    const csv = `${SCALABLE_HEADER}
2026-05-05;99:99:99;Executed;"SCAL1";"World ETF";Security;Sell;LU0000000001;1;12,00;12,00;0,00;0,00;EUR
2026-05-05;08:51:31;Executed;"SCAL2";"World ETF";Security;Buy;LU0000000001;2;11,198;-22,396;0,00;0,00;EUR`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(2);
    const [sell, buy] = result.records;
    // Newest-first file-order synthesis still orders the sell after the buy.
    expect(sell.executedAt! > buy.executedAt!).toBe(true);
  });

  it("normalizes buy, sell, and savings plan rows with broker references", async () => {
    const csv = `${SCALABLE_HEADER}
2026-05-13;12:56:05;Executed;"SCAL1";"World ETF";Security;Savings plan;LU0000000001;3,140309;159,22;-499,99999898;0,00;0,00;EUR
2026-05-05;08:52:49;Executed;"SCAL2";"World ETF";Security;Buy;LU0000000001;2;11,198;-22,396;0,99;0,00;EUR
2026-05-04;08:17:14;Executed;"SCAL3";"Oil ETC";Security;Sell;JE0000000001;1;77,995;77,995;0,99;0,00;EUR`;

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
        external_transaction_id: "SCAL1",
        executedAt: "2026-05-13T12:56:05.000Z",
      }),
      expect.objectContaining({
        type: "buy",
        date: "2026-05-05",
        quantity: 2,
        unit_value: 11.198,
        external_transaction_id: "SCAL2",
      }),
      expect.objectContaining({
        type: "sell",
        date: "2026-05-04",
        quantity: 1,
        unit_value: 77.995,
        external_transaction_id: "SCAL3",
      }),
    ]);
    expect(
      result.warnings?.some((warning) => warning.includes("fee/tax")),
    ).toBe(true);
  });

  it("ignores deposits and other non-trade rows with a warning", async () => {
    const csv = `${SCALABLE_HEADER}
2026-05-11;02:00:00;Executed;"CASH1";"Piano di accumulo";Cash;Deposit;;;;500,00;0,00;;EUR
2026-05-05;08:52:49;Executed;"SCAL1";"World ETF";Security;Buy;LU0000000001;2;11,198;-22,396;0,00;0,00;EUR`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.ignoredRowCount).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(
      result.warnings?.some((warning) => warning.includes("non-trade")),
    ).toBe(true);
  });

  it("ignores cancelled and pending orders with a warning", async () => {
    const csv = `${SCALABLE_HEADER}
2026-04-30;08:25:32;Executed;"SCAL1";"Oil ETC";Security;Buy;JE0000000001;1;83,80;-83,80;0,99;0,00;EUR
2026-04-30;08:24:25;Cancelled;"SCAL2";"Oil ETC";Security;Buy;JE0000000001;0;0,00;0,00;0,00;0,00;EUR
2026-04-30;08:20:00;Open;"SCAL3";"Oil ETC";Security;Buy;JE0000000001;1;83,00;-83,00;0,99;0,00;EUR`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.ignoredRowCount).toBe(2);
    expect(
      result.warnings?.some((warning) => warning.includes("not executed")),
    ).toBe(true);
  });

  it("skips duplicate references and errors on missing ones", async () => {
    const csv = `${SCALABLE_HEADER}
2026-05-05;08:52:49;Executed;"SCAL1";"World ETF";Security;Buy;LU0000000001;2;11,198;-22,396;0,00;0,00;EUR
2026-05-05;08:52:49;Executed;"SCAL1";"World ETF";Security;Buy;LU0000000001;2;11,198;-22,396;0,00;0,00;EUR
2026-05-04;08:00:00;Executed;;"World ETF";Security;Buy;LU0000000001;1;11,00;-11,00;0,00;0,00;EUR`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(false);
    expect(result.records).toHaveLength(1);
    expect(result.duplicateTransactionIdCount).toBe(1);
    expect(
      result.errors?.some((error) => error.includes("Missing reference")),
    ).toBe(true);
  });

  it("rejects rows that mix trade currencies for one instrument", async () => {
    const csv = `${SCALABLE_HEADER}
2026-05-05;08:52:49;Executed;"SCAL1";"World ETF";Security;Buy;LU0000000001;2;11,00;-22,00;0,00;0,00;EUR
2026-05-04;08:00:00;Executed;"SCAL2";"World ETF";Security;Buy;LU0000000001;1;12,00;-12,00;0,00;0,00;USD`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(false);
    expect(
      result.errors?.some((error) => error.includes("mixes trade currencies")),
    ).toBe(true);
  });

  it("orders same-day trades by execution time", async () => {
    // File is newest-first, but the buy at 08:51 happened before the sell at
    // 09:10 on the same day.
    const csv = `${SCALABLE_HEADER}
2026-05-05;09:10:00;Executed;"SCAL1";"World ETF";Security;Sell;LU0000000001;2;12,00;24,00;0,00;0,00;EUR
2026-05-05;08:51:31;Executed;"SCAL2";"World ETF";Security;Buy;LU0000000001;2;11,198;-22,396;0,00;0,00;EUR`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    const [sell, buy] = result.records;
    expect(sell.executedAt! > buy.executedAt!).toBe(true);
  });
});
