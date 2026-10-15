import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseBrokerTransactionsCSV } from "@/lib/import/broker-transactions/registry";

const resolveBrokerTransactionInstrumentsMock = vi.fn();
const tableData: Record<string, unknown[]> = {};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/positions/create", () => ({ createPosition: vi.fn() }));
vi.mock("@/server/position-snapshots/recalculate", () => ({
  recalculateSnapshotsUntilNextUpdate: vi.fn(),
}));
vi.mock("@/server/portfolio-records/validate-timeline", () => ({
  validatePortfolioRecordTimelineWindow: vi.fn(),
}));
vi.mock("@/server/exchange-rates/fetch", () => ({
  fetchExchangeRates: vi.fn(),
}));
vi.mock("@/server/import/broker-transactions/instrument-resolution", () => ({
  resolveBrokerTransactionInstruments: resolveBrokerTransactionInstrumentsMock,
}));
vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: async () => ({
    user: { id: "user-1" },
    supabase: {
      // Every query in the preview path is a filter chain awaited for rows.
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          is: () => query,
          in: () => query,
          then: (resolve: (value: unknown) => void) =>
            resolve({ data: tableData[table] ?? [], error: null }),
        };
        return query;
      },
    },
  }),
}));

const DIRECTA_CSV = [
  "Data operazione;Data valuta;Tipo operazione;Ticker;Isin;Protocollo;Descrizione;Quantità;Importo euro;Importo Divisa;Divisa;Riferimento ordine",
  "15/07/2026;17/07/2026;Acquisto;VWCE;IE00BK5BQT80;;Vanguard Ftse All-World Ucits;9;-1492,11;0;EUR;X3",
  "03/09/2025;05/09/2025;Vendita;1GOOGL;US02079K3059;;ALPHABET CLASSE A;4;787,44;0;EUR;X2",
  "10/04/2025;14/04/2025;Acquisto;1GOOGL;US02079K3059;;ALPHABET CLASSE A;4;-577,6;0;EUR;X1",
].join("\n");

describe("previewBrokerImport", () => {
  beforeEach(() => {
    resolveBrokerTransactionInstrumentsMock.mockReset();
    resolveBrokerTransactionInstrumentsMock.mockResolvedValue(new Map());
    tableData.positions = [];
    tableData.portfolio_records = [];
  });

  it("does not offer positions whose records were all imported already", async () => {
    // Alphabet was imported, closed and archived: its records exist but no
    // active position matches its name anymore.
    const parsed = await parseBrokerTransactionsCSV(DIRECTA_CSV);
    tableData.portfolio_records = parsed.records
      .filter((record) => record.positionName === "ALPHABET CLASSE A")
      .map((record) => ({
        external_transaction_id: record.external_transaction_id,
      }));

    const { previewBrokerImport } = await import("./import");
    const preview = await previewBrokerImport(DIRECTA_CSV);

    expect(preview).toMatchObject({
      success: true,
      recordsToImportCount: 1,
      duplicateRecordsSkippedCount: 2,
    });
    expect(
      preview.success && preview.positionsToCreate.map(({ name }) => name),
    ).toEqual(["Vanguard Ftse All-World Ucits"]);
    expect(
      resolveBrokerTransactionInstrumentsMock.mock.calls[0][0].positions.map(
        ({ name }: { name: string }) => name,
      ),
    ).toEqual(["Vanguard Ftse All-World Ucits"]);
  });
});
