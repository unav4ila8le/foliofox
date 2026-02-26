import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchQuotesMock = vi.fn();

vi.mock("@/server/quotes/fetch", () => ({
  fetchQuotes: fetchQuotesMock,
}));

describe("symbolHandler", () => {
  beforeEach(() => {
    fetchQuotesMock.mockReset();
  });

  it("keeps single-date quote fetch behavior unchanged", async () => {
    const expected = new Map([["sym-1|2026-02-25", 123]]);
    fetchQuotesMock.mockResolvedValue(expected);

    const { symbolHandler } = await import("./symbol-handler");
    const result = await symbolHandler.fetchForPositions(
      [
        {
          id: "pos-1",
          currency: "USD",
          symbol_id: "sym-1",
          domain_id: null,
        },
      ],
      new Date("2026-02-25T00:00:00.000Z"),
      { upsert: true },
    );

    expect(result).toBe(expected);
    expect(fetchQuotesMock).toHaveBeenCalledTimes(1);
    expect(fetchQuotesMock).toHaveBeenCalledWith(
      [{ symbolLookup: "sym-1", date: new Date("2026-02-25T00:00:00.000Z") }],
      { upsert: true },
    );
  });

  it("disables live miss repair for range requests", async () => {
    const expected = new Map([["sym-1|2026-02-25", 123]]);
    fetchQuotesMock.mockResolvedValue(expected);

    const { symbolHandler } = await import("./symbol-handler");
    expect(symbolHandler.fetchForPositionsRange).toBeTypeOf("function");
    const result = await symbolHandler.fetchForPositionsRange!(
      [
        {
          id: "pos-1",
          currency: "USD",
          symbol_id: "sym-1",
          domain_id: null,
        },
      ],
      [new Date("2026-02-25T00:00:00.000Z")],
      { upsert: true },
    );

    expect(result).toBe(expected);
    expect(fetchQuotesMock).toHaveBeenCalledTimes(1);
    expect(fetchQuotesMock).toHaveBeenCalledWith(
      [{ symbolLookup: "sym-1", date: new Date("2026-02-25T00:00:00.000Z") }],
      { upsert: true, liveFetchOnMiss: false },
    );
  });
});
