import { describe, expect, it } from "vitest";

import {
  detectBrokerTransactionAdapter,
  parseBrokerTransactionsCSV,
} from "./registry";

const DIRECTA_PREAMBLE = `Conto : 12345 MARIO ROSSI;;;;;;;;;;;
Data estrazione : 15-7-2026 11:53:37;;;;;;;;;;;
;;;;;;;;;;;
Compravendite ordinati per Data Operazione;;;;;;;;;;;
Dal : 01-01-2020;;;;;;;;;;;
al : 15-07-2026;;;;;;;;;;;
;;;;;;;;;;;
Il file include i primi 3000 movimenti;;;;;;;;;;;
;;;;;;;;;;;`;
const DIRECTA_HEADER =
  "Data operazione;Data valuta;Tipo operazione;Ticker;Isin;Protocollo;Descrizione;Quantità;Importo euro;Importo Divisa;Divisa;Riferimento ordine";

function buildDirectaCSV(rows: string[]): string {
  return [DIRECTA_PREAMBLE, DIRECTA_HEADER, ...rows].join("\n");
}

describe("Directa broker transaction adapter", () => {
  it("detects Directa exports despite the metadata preamble", () => {
    const adapter = detectBrokerTransactionAdapter(
      buildDirectaCSV([
        "15/01/2026;19/01/2026;Acquisto;VWCE;IE0000000001;;World ETF;2;-300,52;0;EUR;X123",
      ]),
    );

    expect(adapter?.source).toBe("directa");
  });

  it("normalizes buys and sells with dd/mm/yyyy dates and derived unit prices", async () => {
    const csv = buildDirectaCSV([
      "15/01/2026;19/01/2026;Vendita;VWCE;IE0000000001;;World ETF;2;220,00;0;EUR;X124",
      "11/10/2022;13/10/2022;Acquisto;VWCE;IE0000000001;;World ETF;11;-997,15;0;EUR;X123",
    ]);

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.source).toBe("directa");
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toMatchObject({
      name: "World ETF",
      category_id: "other",
      currency: "EUR",
      brokerSymbol: "IE0000000001",
      earliestTradeDate: "2022-10-11",
      firstUnitValue: 997.15 / 11,
      endingQuantity: 9,
    });
    expect(result.records).toEqual([
      expect.objectContaining({
        type: "sell",
        date: "2026-01-15",
        quantity: 2,
        unit_value: 110,
      }),
      expect.objectContaining({
        type: "buy",
        date: "2022-10-11",
        quantity: 11,
        unit_value: 997.15 / 11,
      }),
    ]);
  });

  it("ignores commission and other non-trade rows with warnings", async () => {
    const csv = buildDirectaCSV([
      "15/01/2026;19/01/2026;Acquisto;VWCE;IE0000000001;;World ETF;2;-300,52;0;EUR;X123",
      "15/01/2026;19/01/2026;Commissioni;VWCE;IE0000000001;;World ETF;0;-1,5;0;EUR;X123",
      "10/01/2026;12/01/2026;Dividendi;VWCE;IE0000000001;;World ETF;0;12,00;0;EUR;X122",
    ]);

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.ignoredRowCount).toBe(2);
    expect(
      result.warnings?.some((warning) => warning.includes("commission")),
    ).toBe(true);
    expect(
      result.warnings?.some((warning) => warning.includes("non-trade")),
    ).toBe(true);
  });

  it("uses the native currency amount for non-EUR trades", async () => {
    const csv = buildDirectaCSV([
      "21/01/2021;25/01/2021;Acquisto;.ACME;US0000000001;;ACME INC;12;-185,94;-226,17;USD;X123",
    ]);

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.positions[0]).toMatchObject({ currency: "USD" });
    expect(result.records[0]).toMatchObject({
      quantity: 12,
      unit_value: 226.17 / 12,
    });
  });

  it("keeps synthetic IDs stable across differently mangled order references", async () => {
    // Two fills of the same order are identical rows; an Excel round-trip can
    // mangle the order reference, which must not change the record IDs.
    const exportA = buildDirectaCSV([
      "22/06/2026;24/06/2026;Acquisto;WWRD;XS0000000001;;World ETF;100;-2500,5;0;EUR;17300000000000",
      "22/06/2026;24/06/2026;Acquisto;WWRD;XS0000000001;;World ETF;100;-2500,5;0;EUR;17300000000000",
    ]);
    const exportB = buildDirectaCSV([
      "22/06/2026;24/06/2026;Acquisto;WWRD;XS0000000001;;World ETF;100;-2500,50;0;EUR;1,73E+13",
      "22/06/2026;24/06/2026;Acquisto;WWRD;XS0000000001;;World ETF;100;-2500,50;0;EUR;1,73E+13",
    ]);

    const resultA = await parseBrokerTransactionsCSV(exportA);
    const resultB = await parseBrokerTransactionsCSV(exportB);

    const idsA = resultA.records.map(
      (record) => record.external_transaction_id,
    );
    expect(new Set(idsA).size).toBe(2);
    expect(
      resultB.records.map((record) => record.external_transaction_id),
    ).toEqual(idsA);
  });

  it("rejects rows that mix trade currencies for one instrument", async () => {
    const csv = buildDirectaCSV([
      "16/01/2026;20/01/2026;Vendita;.ACME;US0000000001;;ACME INC;1;50,00;60,00;USD;X2",
      "15/01/2026;19/01/2026;Acquisto;ACME;US0000000001;;ACME INC;2;-100,00;0;EUR;X1",
    ]);

    const result = await parseBrokerTransactionsCSV(csv);

    expect(result.success).toBe(false);
    expect(
      result.errors?.some((error) => error.includes("mixes trade currencies")),
    ).toBe(true);
  });

  it("orders same-day trades chronologically in newest-first exports", async () => {
    const csv = buildDirectaCSV([
      "15/01/2026;19/01/2026;Vendita;VWCE;IE0000000001;;World ETF;2;220,00;0;EUR;X125",
      "15/01/2026;19/01/2026;Acquisto;VWCE;IE0000000001;;World ETF;2;-210,00;0;EUR;X124",
      "10/01/2026;12/01/2026;Acquisto;VWCE;IE0000000001;;World ETF;1;-100,00;0;EUR;X123",
    ]);

    const result = await parseBrokerTransactionsCSV(csv);
    const [sell, buy] = result.records.filter(
      (record) => record.date === "2026-01-15",
    );

    expect(sell.executedAt! > buy.executedAt!).toBe(true);
  });
});
