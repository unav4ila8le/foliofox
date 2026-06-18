import { describe, expect, it } from "vitest";

import {
  detectBrokerTransactionAdapter,
  parseBrokerTransactionsCSV,
} from "./registry";

const TRADE_REPUBLIC_HEADER =
  "datetime,date,account_type,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,currency,original_amount,original_currency,fx_rate,description,transaction_id,counterparty_name,counterparty_iban,payment_reference,mcc_code";

describe("Trade Republic broker transaction adapter", () => {
  it("detects Trade Republic transaction exports by header shape", () => {
    const adapter = detectBrokerTransactionAdapter(`${TRADE_REPUBLIC_HEADER}
2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,1,10,-10,-1,,EUR,,,,,txn-1,,,,`);

    expect(adapter?.source).toBe("trade_republic");
  });

  it("normalizes buy and sell rows into position and record drafts", async () => {
    const csv = `${TRADE_REPUBLIC_HEADER}
2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,10,12.50,-125,-1,,EUR,,,,Initial buy,txn-1,,,,
2024-01-02T00:00:00Z,2024-01-02,DEFAULT,TRADING,SELL,STOCK,Acme,US0000000001,-4,15.00,60,-1,,EUR,,,,Partial sell,txn-2,,,,`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.source).toBe("trade_republic");
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toMatchObject({
      name: "Acme",
      category_id: "equity",
      currency: "EUR",
      brokerSymbol: "US0000000001",
      earliestTradeDate: "2024-01-01",
      firstUnitValue: 12.5,
      endingQuantity: 6,
    });
    expect(result.records).toEqual([
      expect.objectContaining({
        type: "buy",
        quantity: 10,
        unit_value: 12.5,
        external_transaction_id: "txn-1",
      }),
      expect.objectContaining({
        type: "sell",
        quantity: 4,
        unit_value: 15,
        external_transaction_id: "txn-2",
      }),
    ]);
    expect(
      result.warnings?.some((warning) => warning.includes("fee/tax")),
    ).toBe(true);
  });

  it("keeps fully sold instruments as position drafts", async () => {
    const csv = `${TRADE_REPUBLIC_HEADER}
2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,FUND,World ETF,IE0000000001,2,100,-200,,,EUR,,,,,txn-1,,,,
2024-01-03T00:00:00Z,2024-01-03,DEFAULT,TRADING,SELL,FUND,World ETF,IE0000000001,-2,105,210,,,EUR,,,,,txn-2,,,,`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].endingQuantity).toBe(0);
    expect(result.records).toHaveLength(2);
  });

  it("ignores non-trading rows and warns once", async () => {
    const csv = `${TRADE_REPUBLIC_HEADER}
2024-01-01T00:00:00Z,2024-01-01,DEFAULT,CASH,DIVIDEND,STOCK,Acme,US0000000001,10,,5,,,-1,EUR,,,,div-1,,,,
2024-01-02T00:00:00Z,2024-01-02,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,1,10,-10,,,EUR,,,,,txn-1,,,,`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.ignoredRowCount).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(
      result.warnings?.some((warning) =>
        warning.includes("cash movements, dividends, interest"),
      ),
    ).toBe(true);
  });

  it("skips duplicate transaction IDs within a file", async () => {
    const csv = `${TRADE_REPUBLIC_HEADER}
2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,1,10,-10,,,EUR,,,,,txn-1,,,,
2024-01-02T00:00:00Z,2024-01-02,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,1,11,-11,,,EUR,,,,,txn-1,,,,`;

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.duplicateTransactionIdCount).toBe(1);
    expect(result.ignoredRowCount).toBe(1);
  });

  it("returns no adapter for ordinary position CSVs", async () => {
    const result = await parseBrokerTransactionsCSV(
      "name,category_id,currency,quantity,unit_value\nApple,equity,USD,1,100",
    );

    expect(result.success).toBe(false);
    expect(result.source).toBeNull();
  });
});
