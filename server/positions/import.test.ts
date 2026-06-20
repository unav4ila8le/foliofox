import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const createPositionMock = vi.fn();
const revalidatePathMock = vi.fn();
const recalculateSnapshotsUntilNextUpdateMock = vi.fn();
const validatePortfolioRecordTimelineWindowMock = vi.fn();
const resolveBrokerTransactionInstrumentsMock = vi.fn();
const fetchExchangeRatesMock = vi.fn();

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/server/positions/create", () => ({
  createPosition: createPositionMock,
}));

vi.mock("@/server/position-snapshots/recalculate", () => ({
  recalculateSnapshotsUntilNextUpdate: recalculateSnapshotsUntilNextUpdateMock,
}));

vi.mock("@/server/portfolio-records/validate-timeline", () => ({
  validatePortfolioRecordTimelineWindow:
    validatePortfolioRecordTimelineWindowMock,
}));

vi.mock("@/server/import/broker-transactions/instrument-resolution", () => ({
  resolveBrokerTransactionInstruments: resolveBrokerTransactionInstrumentsMock,
}));

vi.mock("@/server/exchange-rates/fetch", () => ({
  fetchExchangeRates: fetchExchangeRatesMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

type PositionRow = {
  id: string;
  name: string;
  currency: string;
};

type PortfolioRecordInsert = {
  user_id: string;
  position_id: string;
  type: "buy" | "sell" | "update";
  date: string;
  quantity: number;
  unit_value: number;
  description: string | null;
  created_at: string;
  import_source: string | null;
  external_transaction_id: string | null;
};

type FakeState = {
  positions: PositionRow[];
  existingExternalTransactionIds: string[];
  insertedRecords: PortfolioRecordInsert[];
};

class FakeQuery {
  private selectedColumns = "";
  private insertPayload: PortfolioRecordInsert[] | null = null;
  private importSourceFilter: string | null = null;
  private externalTransactionIdsFilter: string[] | null = null;

  constructor(
    private readonly table: string,
    private readonly state: FakeState,
  ) {}

  select(columns = "") {
    this.selectedColumns = columns;
    return this;
  }

  insert(payload: PortfolioRecordInsert[]) {
    this.insertPayload = payload;
    this.state.insertedRecords.push(...payload);
    return this;
  }

  eq(column: string, value: string) {
    if (column === "import_source") {
      this.importSourceFilter = value;
    }
    return this;
  }

  is() {
    return this;
  }

  in(column: string, values: string[]) {
    if (column === "external_transaction_id") {
      this.externalTransactionIdsFilter = values;
    }
    return this;
  }

  gte() {
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    if (this.table === "positions") {
      return { data: this.state.positions, error: null };
    }

    if (this.table !== "portfolio_records") {
      throw new Error(`Unexpected table in test stub: ${this.table}`);
    }

    if (this.insertPayload) {
      return {
        data: this.insertPayload.map((record, index) => ({
          id: `record-${index + 1}`,
          position_id: record.position_id,
          date: record.date,
        })),
        error: null,
      };
    }

    if (this.selectedColumns === "external_transaction_id") {
      return {
        data: this.state.existingExternalTransactionIds
          .filter((id) => this.externalTransactionIdsFilter?.includes(id))
          .map((id) => ({
            external_transaction_id:
              this.importSourceFilter === "trade_republic" ? id : null,
          })),
        error: null,
      };
    }

    return { data: [], error: null };
  }
}

function createSupabaseStub(state: FakeState) {
  return {
    from: (table: string) => new FakeQuery(table, state),
  };
}

const TRADE_REPUBLIC_HEADER =
  "datetime,date,account_type,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,currency,original_amount,original_currency,fx_rate,description,transaction_id,counterparty_name,counterparty_iban,payment_reference,mcc_code";

function createTradeRepublicCSV(rows: string[]) {
  return [TRADE_REPUBLIC_HEADER, ...rows].join("\n");
}

describe("importPositionsFromCSV broker transaction routing", () => {
  let state: FakeState;

  beforeEach(() => {
    state = {
      positions: [],
      existingExternalTransactionIds: [],
      insertedRecords: [],
    };

    getCurrentUserMock.mockReset();
    getCurrentUserMock.mockImplementation(() => ({
      supabase: createSupabaseStub(state),
      user: { id: "user-1" },
    }));

    createPositionMock.mockReset();
    createPositionMock.mockImplementation((formData: FormData) => {
      state.positions.push({
        id: `position-${state.positions.length + 1}`,
        name: String(formData.get("name")),
        currency: String(formData.get("currency")),
      });
      return { success: true };
    });

    revalidatePathMock.mockReset();
    recalculateSnapshotsUntilNextUpdateMock.mockReset();
    recalculateSnapshotsUntilNextUpdateMock.mockResolvedValue({
      success: true,
    });
    validatePortfolioRecordTimelineWindowMock.mockReset();
    validatePortfolioRecordTimelineWindowMock.mockResolvedValue({
      valid: true,
    });
    fetchExchangeRatesMock.mockReset();
    fetchExchangeRatesMock.mockResolvedValue(new Map());
    resolveBrokerTransactionInstrumentsMock.mockReset();
    resolveBrokerTransactionInstrumentsMock.mockImplementation(
      ({ positions }) =>
        new Map(
          positions.map((position: { positionKey: string }) => [
            position.positionKey,
            {
              state: "auto_linked",
              positionKey: position.positionKey,
              symbolId: `symbol-${position.positionKey}`,
              candidates: [],
            },
          ]),
        ),
    );
  });

  it("creates missing positions and imports broker records with external IDs", async () => {
    const csv = createTradeRepublicCSV([
      "2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,2,10,-20,,,EUR,,,,Initial buy,txn-1,,,,",
      "2024-01-02T00:00:00Z,2024-01-02,DEFAULT,TRADING,SELL,STOCK,Acme,US0000000001,-1,12,12,,,EUR,,,,Partial sell,txn-2,,,,",
    ]);

    const { importPositionsFromCSV } = await import("./import");
    const result = await importPositionsFromCSV(csv);

    expect(result).toMatchObject({
      success: true,
      importedCount: 2,
      createdPositionCount: 1,
      matchedPositionCount: 0,
      skippedCount: 0,
    });
    expect(createPositionMock).toHaveBeenCalledTimes(1);
    const createFormData = createPositionMock.mock.calls[0][0] as FormData;
    expect(createFormData.get("quantity")).toBe("0");
    expect(createFormData.get("symbolLookup")).toBe(
      "symbol-trade_republic:us0000000001:acme",
    );
    expect(state.insertedRecords).toEqual([
      expect.objectContaining({
        import_source: "trade_republic",
        external_transaction_id: "txn-1",
        type: "buy",
        quantity: 2,
      }),
      expect.objectContaining({
        import_source: "trade_republic",
        external_transaction_id: "txn-2",
        type: "sell",
        quantity: 1,
      }),
    ]);
    expect(recalculateSnapshotsUntilNextUpdateMock).toHaveBeenCalled();
  });

  it("skips already imported external transaction IDs", async () => {
    state.positions.push({ id: "position-1", name: "Acme", currency: "EUR" });
    state.existingExternalTransactionIds.push("txn-1");
    const csv = createTradeRepublicCSV([
      "2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,2,10,-20,,,EUR,,,,Initial buy,txn-1,,,,",
    ]);

    const { importPositionsFromCSV } = await import("./import");
    const result = await importPositionsFromCSV(csv);

    expect(result).toMatchObject({
      success: true,
      importedCount: 0,
      createdPositionCount: 0,
      matchedPositionCount: 1,
      skippedCount: 1,
    });
    expect(state.insertedRecords).toHaveLength(0);
    expect(createPositionMock).not.toHaveBeenCalled();
  });

  it("stops when a missing broker position needs symbol review", async () => {
    resolveBrokerTransactionInstrumentsMock.mockResolvedValue(
      new Map([
        [
          "trade_republic:us0000000001:acme",
          {
            state: "needs_review",
            positionKey: "trade_republic:us0000000001:acme",
            candidates: [{ ticker: "ACME", currency: "USD" }],
            warning: "Acme has symbol candidates, but none are quoted in EUR.",
          },
        ],
      ]),
    );
    const csv = createTradeRepublicCSV([
      "2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,2,10,-20,,,EUR,,,,Initial buy,txn-1,,,,",
    ]);

    const { importPositionsFromCSV } = await import("./import");
    const result = await importPositionsFromCSV(csv);

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("Symbol review is required"),
    });
    expect(createPositionMock).not.toHaveBeenCalled();
    expect(state.insertedRecords).toHaveLength(0);
  });

  it("passes selected broker symbols into instrument resolution", async () => {
    const csv = createTradeRepublicCSV([
      "2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,2,10,-20,,,EUR,,,,Initial buy,txn-1,,,,",
    ]);

    const { importPositionsFromCSV } = await import("./import");
    await importPositionsFromCSV(csv, "asset", {
      broker: {
        selectedSymbolTickers: {
          "trade_republic:us0000000001:acme": "ACME.DE",
        },
      },
    });

    expect(resolveBrokerTransactionInstrumentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedSymbolTickers: {
          "trade_republic:us0000000001:acme": "ACME.DE",
        },
      }),
    );
  });

  it("converts broker record values into selected symbol currency", async () => {
    resolveBrokerTransactionInstrumentsMock.mockResolvedValue(
      new Map([
        [
          "trade_republic:us0000000001:acme",
          {
            state: "auto_linked",
            positionKey: "trade_republic:us0000000001:acme",
            symbolId: "symbol-1",
            selectedTicker: "ACME",
            candidates: [{ ticker: "ACME", currency: "USD" }],
          },
        ],
      ]),
    );
    fetchExchangeRatesMock.mockResolvedValue(
      new Map([
        ["EUR|2024-01-01", 0.5],
        ["USD|2024-01-01", 1],
      ]),
    );
    const csv = createTradeRepublicCSV([
      "2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,2,10,-20,,,EUR,,,,Initial buy,txn-1,,,,",
    ]);

    const { importPositionsFromCSV } = await import("./import");
    const result = await importPositionsFromCSV(csv, "asset", {
      broker: {
        selectedSymbolTickers: {
          "trade_republic:us0000000001:acme": "ACME",
        },
      },
    });

    expect(result.success).toBe(true);
    const createFormData = createPositionMock.mock.calls[0][0] as FormData;
    expect(createFormData.get("currency")).toBe("USD");
    expect(createFormData.get("unit_value")).toBe("20");
    expect(state.insertedRecords[0]).toMatchObject({
      unit_value: 20,
    });
  });

  it("blocks cross-currency broker import when FX rates are missing", async () => {
    resolveBrokerTransactionInstrumentsMock.mockResolvedValue(
      new Map([
        [
          "trade_republic:us0000000001:acme",
          {
            state: "auto_linked",
            positionKey: "trade_republic:us0000000001:acme",
            symbolId: "symbol-1",
            selectedTicker: "ACME",
            candidates: [{ ticker: "ACME", currency: "USD" }],
          },
        ],
      ]),
    );
    fetchExchangeRatesMock.mockResolvedValue(new Map([["USD|2024-01-01", 1]]));
    const csv = createTradeRepublicCSV([
      "2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,2,10,-20,,,EUR,,,,Initial buy,txn-1,,,,",
    ]);

    const { importPositionsFromCSV } = await import("./import");
    const result = await importPositionsFromCSV(csv, "asset", {
      broker: {
        selectedSymbolTickers: {
          "trade_republic:us0000000001:acme": "ACME",
        },
      },
    });

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("Missing historical FX rates"),
    });
    expect(createPositionMock).not.toHaveBeenCalled();
    expect(state.insertedRecords).toHaveLength(0);
  });

  it("converts broker records into an existing matched position currency", async () => {
    state.positions.push({ id: "position-1", name: "Acme", currency: "USD" });
    fetchExchangeRatesMock.mockResolvedValue(
      new Map([
        ["EUR|2024-01-01", 0.5],
        ["USD|2024-01-01", 1],
      ]),
    );
    const csv = createTradeRepublicCSV([
      "2024-01-01T00:00:00Z,2024-01-01,DEFAULT,TRADING,BUY,STOCK,Acme,US0000000001,2,10,-20,,,EUR,,,,Initial buy,txn-1,,,,",
    ]);

    const { importPositionsFromCSV } = await import("./import");
    const result = await importPositionsFromCSV(csv);

    expect(result.success).toBe(true);
    expect(createPositionMock).not.toHaveBeenCalled();
    expect(state.insertedRecords[0]).toMatchObject({
      position_id: "position-1",
      unit_value: 20,
    });
  });
});
