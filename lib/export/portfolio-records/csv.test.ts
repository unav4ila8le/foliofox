import { describe, expect, it } from "vitest";

import {
  parseCSVRowValues,
  splitCSVRecords,
} from "@/lib/import/shared/csv-parser-utils";
import { portfolioRecordsToCSV, type PortfolioRecordCsvRow } from "./csv";

describe("portfolioRecordsToCSV", () => {
  it("returns only headers when there are no rows", () => {
    const csv = portfolioRecordsToCSV([]);

    expect(csv).toBe("position_name,type,date,quantity,unit_value,description");
  });

  it("keeps header order and serializes values in canonical column order", () => {
    const rows: PortfolioRecordCsvRow[] = [
      {
        position_name: "Apple Inc",
        type: "buy",
        date: "2026-03-09",
        quantity: 10,
        unit_value: 155.25,
        description: "Initial purchase",
      },
    ];

    const csv = portfolioRecordsToCSV(rows);
    const records = splitCSVRecords(csv);

    expect(records).toHaveLength(2);
    expect(records[0]).toBe(
      "position_name,type,date,quantity,unit_value,description",
    );
    expect(parseCSVRowValues(records[1], ",")).toEqual([
      "Apple Inc",
      "buy",
      "2026-03-09",
      "10",
      "155.25",
      "Initial purchase",
    ]);
  });

  it("escapes commas, quotes, and newlines and handles null/undefined description", () => {
    const rows = [
      {
        position_name: 'ACME, "Class A"',
        type: "update",
        date: "2026-03-09",
        quantity: 3,
        unit_value: 101.5,
        description: 'Line one\nLine "two"',
      },
      {
        position_name: "No Notes Position",
        type: "sell",
        date: "2026-03-10",
        quantity: 1,
        unit_value: 250,
        description: null,
      },
      {
        position_name: "Undefined Notes Position",
        type: "buy",
        date: "2026-03-11",
        quantity: 2,
        unit_value: 300,
        description: undefined,
      },
    ] as unknown as PortfolioRecordCsvRow[];

    const csv = portfolioRecordsToCSV(rows);
    const records = splitCSVRecords(csv);

    expect(records).toHaveLength(4);
    expect(parseCSVRowValues(records[1], ",")).toEqual([
      'ACME, "Class A"',
      "update",
      "2026-03-09",
      "3",
      "101.5",
      'Line one\nLine "two"',
    ]);
    expect(parseCSVRowValues(records[2], ",")).toEqual([
      "No Notes Position",
      "sell",
      "2026-03-10",
      "1",
      "250",
      "",
    ]);
    expect(parseCSVRowValues(records[3], ",")).toEqual([
      "Undefined Notes Position",
      "buy",
      "2026-03-11",
      "2",
      "300",
      "",
    ]);
  });
});
