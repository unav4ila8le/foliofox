import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseRecordsCSV } from "./records-csv";

describe("parseRecordsCSV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error when CSV has less than 2 lines", async () => {
    const result = await parseRecordsCSV(
      "position_name,type,date,quantity,unit_value\n",
    );

    expect(result.success).toBe(false);
    expect(result.errors).toContain(
      "CSV file must have at least a header row and one data row",
    );
    expect(result.records).toEqual([]);
  });

  it("should return error when CSV is empty", async () => {
    const result = await parseRecordsCSV("");

    expect(result.success).toBe(false);
    expect(result.errors).toContain(
      "CSV file must have at least a header row and one data row",
    );
  });

  it("should return error when required headers are missing", async () => {
    const csv = `position_name,type
Apple Inc,buy`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(
      result.errors?.some((err) => err.includes("Missing required column")),
    ).toBe(true);
  });

  it("should successfully parse valid CSV with all required columns", async () => {
    const csv = `position_name,type,date,quantity,unit_value
Apple Inc,buy,2024-01-15,10,150.50
Microsoft,sell,2024-01-16,5,380.25`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records.length).toBe(2);
    expect(result.records[0]).toEqual({
      position_name: "Apple Inc",
      type: "buy",
      date: "2024-01-15",
      quantity: 10,
      unit_value: 150.5,
      description: null,
    });
    expect(result.records[1]).toEqual({
      position_name: "Microsoft",
      type: "sell",
      date: "2024-01-16",
      quantity: 5,
      unit_value: 380.25,
      description: null,
    });
  });

  it("should parse CSV with optional description column", async () => {
    const csv = `position_name,type,date,quantity,unit_value,description
Apple Inc,buy,2024-01-15,10,150.50,Initial purchase
Microsoft,update,2024-01-16,15,380.25,Quarterly update`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records.length).toBe(2);
    expect(result.records[0].description).toBe("Initial purchase");
    expect(result.records[1].description).toBe("Quarterly update");
    expect(result.records[1].type).toBe("update");
  });

  it("should handle tab-delimited CSV", async () => {
    const csv = `position_name\ttype\tdate\tquantity\tunit_value
Apple Inc\tbuy\t2024-01-15\t10\t150.50`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records.length).toBe(1);
    expect(result.records[0].position_name).toBe("Apple Inc");
  });

  it("should handle semicolon-delimited CSV", async () => {
    const csv = `position_name;type;date;quantity;unit_value
Apple Inc;buy;2024-01-15;10;150.50`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records.length).toBe(1);
    expect(result.records[0].position_name).toBe("Apple Inc");
  });

  it("should return error for invalid record type", async () => {
    const csv = `position_name,type,date,quantity,unit_value
Apple Inc,purchase,2024-01-15,10,150.50`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(
      result.errors?.some((err) => err.includes('Invalid type "purchase"')),
    ).toBe(true);
  });

  it("should return error for invalid quantity", async () => {
    const csv = `position_name,type,date,quantity,unit_value
Apple Inc,buy,2024-01-15,abc,150.50`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(
      result.errors?.some((err) => err.includes('Invalid quantity "abc"')),
    ).toBe(true);
  });

  it("should return error for invalid unit_value", async () => {
    const csv = `position_name,type,date,quantity,unit_value
Apple Inc,buy,2024-01-15,10,xyz`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(
      result.errors?.some((err) => err.includes('Invalid unit_value "xyz"')),
    ).toBe(true);
  });

  it("should return error for missing position name", async () => {
    const csv = `position_name,type,date,quantity,unit_value
,buy,2024-01-15,10,150.50`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(
      result.errors?.some((err) => err.includes("Missing position name")),
    ).toBe(true);
  });

  it("should return error for missing date", async () => {
    const csv = `position_name,type,date,quantity,unit_value
Apple Inc,buy,,10,150.50`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some((err) => err.includes("Missing date"))).toBe(
      true,
    );
  });

  it("should handle CSV with quoted values containing delimiters", async () => {
    const csv = `position_name,type,date,quantity,unit_value,description
"Company, Inc.",buy,2024-01-15,10,150.50,"Initial purchase, Q1"`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records[0].position_name).toBe("Company, Inc.");
    expect(result.records[0].description).toBe("Initial purchase, Q1");
  });

  it("should normalize record type to lowercase", async () => {
    const csv = `position_name,type,date,quantity,unit_value
Apple Inc,BUY,2024-01-15,10,150.50
Microsoft,SELL,2024-01-16,5,380.25
Tesla,UPDATE,2024-01-17,3,250.00`;

    const result = await parseRecordsCSV(csv);

    expect(result.success).toBe(true);
    expect(result.records[0].type).toBe("buy");
    expect(result.records[1].type).toBe("sell");
    expect(result.records[2].type).toBe("update");
  });
});
