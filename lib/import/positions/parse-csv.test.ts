import { describe, it, expect, vi, beforeEach } from "vitest";
import { parsePositionsCSV } from "./parse-csv";
import { positionsToCSV } from "./serialize";

// Mock only the currencies fetch function
vi.mock("@/server/currencies/fetch", () => ({
  fetchCurrencies: vi.fn(async () => [
    { alphabetic_code: "USD" },
    { alphabetic_code: "EUR" },
    { alphabetic_code: "GBP" },
  ]),
}));

describe("parsePositionsCSV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error when CSV has less than 2 lines", async () => {
    const result = await parsePositionsCSV("name,quantity\n");

    expect(result.success).toBe(false);
    expect(result.errors).toContain(
      "CSV file must have at least a header row and one data row",
    );
    expect(result.positions).toEqual([]);
  });

  it("should return error when CSV is empty", async () => {
    const result = await parsePositionsCSV("");

    expect(result.success).toBe(false);
    expect(result.errors).toContain(
      "CSV file must have at least a header row and one data row",
    );
  });

  it("should detect comma delimiter and parse successfully", async () => {
    const csv = `name,quantity,currency
Apple Inc,10,USD`;

    const result = await parsePositionsCSV(csv);

    // The parser should detect comma delimiter and process the data
    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.positions[0].name).toBe("Apple Inc");
    expect(result.positions[0].quantity).toBe(10);
    expect(result.positions[0].currency).toBe("USD");
  });

  it("should detect tab delimiter and parse successfully", async () => {
    const csv = `name\tquantity\tcurrency
Apple Inc\t10\tUSD`;

    const result = await parsePositionsCSV(csv);

    // The parser should detect tab delimiter and process the data
    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.positions[0].name).toBe("Apple Inc");
    expect(result.positions[0].quantity).toBe(10);
    expect(result.positions[0].currency).toBe("USD");
  });

  it("should return error when required headers are missing", async () => {
    const csv = `name
Apple Inc`;

    const result = await parsePositionsCSV(csv);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(
      result.errors?.some((err) => err.includes("Missing required column")),
    ).toBe(true);
  });

  it("should successfully parse valid CSV with all required columns", async () => {
    const csv = `name,quantity,currency
Apple Inc,10,USD
Microsoft,5,EUR`;

    const result = await parsePositionsCSV(csv);

    expect(result.positions.length).toBe(2);
    expect(result.positions[0].name).toBe("Apple Inc");
    expect(result.positions[0].quantity).toBe(10);
    expect(result.positions[0].currency).toBe("USD");
    expect(result.positions[1].name).toBe("Microsoft");
    expect(result.positions[1].quantity).toBe(5);
    expect(result.positions[1].currency).toBe("EUR");
    expect(result.positions[0].capital_gains_tax_rate).toBeNull();
  });

  it("should handle CSV with quoted values containing delimiters", async () => {
    const csv = `name,quantity,currency
"Company, Inc.",10,USD`;

    const result = await parsePositionsCSV(csv);

    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.positions[0].name).toBe("Company, Inc.");
  });

  it("should handle escaped quotes in CSV values", async () => {
    const csv = `name,quantity,currency
"Quote ""Test""",10,USD`;

    const result = await parsePositionsCSV(csv);

    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.positions[0].name).toContain("Quote");
    expect(result.positions[0].quantity).toBe(10);
    expect(result.positions[0].currency).toBe("USD");
  });

  it("should return supported currencies in result", async () => {
    const csv = `name,quantity,currency
Apple Inc,10,USD
Microsoft,5,EUR`;

    const result = await parsePositionsCSV(csv);

    expect(result.supportedCurrencies).toBeDefined();
    expect(result.supportedCurrencies).toContain("USD");
    expect(result.supportedCurrencies).toContain("EUR");
    expect(result.supportedCurrencies).toContain("GBP");
  });

  it("should parse optional capital gains tax rate as percentage or decimal", async () => {
    const csv = `name,quantity,currency,unit_value,capital_gains_tax_rate
Apple Inc,10,USD,120,26
Microsoft,5,EUR,90,0.125`;

    const result = await parsePositionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.positions).toHaveLength(2);
    expect(result.positions[0].capital_gains_tax_rate).toBe(26);
    expect(result.positions[1].capital_gains_tax_rate).toBe(0.125);
  });

  it("should keep capital gains tax rate null when column is not provided", async () => {
    const csv = `name,quantity,currency,unit_value
Apple Inc,10,USD,120`;

    const result = await parsePositionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].capital_gains_tax_rate).toBeNull();
  });

  it("should preserve capital gains tax rate on CSV round trip", async () => {
    const csv = positionsToCSV([
      {
        name: "Apple Inc",
        category_id: "equity",
        currency: "USD",
        quantity: 10,
        unit_value: 120,
        cost_basis_per_unit: 98.5,
        capital_gains_tax_rate: 0.26,
        symbolLookup: null,
        description: null,
      },
    ]);

    const result = await parsePositionsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].capital_gains_tax_rate).toBe(0.26);
  });

  it("should return validation error for invalid capital gains tax rate", async () => {
    const csv = `name,quantity,currency,unit_value,capital_gains_tax_rate
Apple Inc,10,USD,120,120`;

    const result = await parsePositionsCSV(csv);

    expect(result.success).toBe(false);
    expect(
      result.errors?.some((error) => error.includes("Capital gains tax rate")),
    ).toBe(true);
  });

  it("should handle errors gracefully when currencies fetch fails", async () => {
    const { fetchCurrencies } = await import("@/server/currencies/fetch");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.mocked(fetchCurrencies).mockRejectedValueOnce(
      new Error("Database error"),
    );

    const csv = `name,quantity,currency
Apple Inc,10,USD`;

    const result = await parsePositionsCSV(csv);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain("Failed to parse CSV");
    expect(consoleError).toHaveBeenCalledWith(
      "Unexpected error during CSV parsing:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
