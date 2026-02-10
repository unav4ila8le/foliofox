import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  TabularFileError,
  buildAiTableText,
  parseTabularFileFromDataUrl,
  rowsToCsv,
  selectBestSheet,
} from "./tabular-file.server";

function toDataUrlFromBuffer(buffer: Buffer, mediaType: string): string {
  return `data:${mediaType};base64,${buffer.toString("base64")}`;
}

function createWorkbookBuffer(
  bookType: "xlsx" | "xls",
  sheetName: string,
  rows: Array<Array<string | number>>,
  options?: {
    merges?: string[];
    formulaCell?: {
      address: string;
      formula: string;
      value?: number;
      formattedValue?: string;
    };
  },
): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  if (options?.merges?.length) {
    sheet["!merges"] = options.merges.map((mergeRef) =>
      XLSX.utils.decode_range(mergeRef),
    );
  }

  if (options?.formulaCell) {
    const { address, formula, value, formattedValue } = options.formulaCell;
    sheet[address] = {
      t: "n",
      f: formula,
      ...(value != null ? { v: value } : {}),
      ...(formattedValue ? { w: formattedValue } : {}),
    } as XLSX.CellObject;
  }

  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType }) as Buffer;
}

describe("parseTabularFileFromDataUrl", () => {
  it("parses CSV files", () => {
    const csv = "name,quantity,currency\nApple,10,USD\n";
    const dataUrl = `data:text/csv;base64,${Buffer.from(csv, "utf8").toString("base64")}`;

    const result = parseTabularFileFromDataUrl({
      dataUrl,
      mediaType: "text/csv",
      filename: "positions.csv",
    });

    expect(result.kind).toBe("csv");
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].rows[0]).toEqual(["name", "quantity", "currency"]);
    expect(result.sheets[0].rows[1]).toEqual(["Apple", "10", "USD"]);
  });

  it("parses CSV records with multiline quoted cells", () => {
    const csv = `name,description,quantity
Apple,"line 1
line 2",10
Microsoft,"single line",5`;
    const dataUrl = `data:text/csv;base64,${Buffer.from(csv, "utf8").toString("base64")}`;

    const result = parseTabularFileFromDataUrl({
      dataUrl,
      mediaType: "text/csv",
      filename: "positions.csv",
    });

    expect(result.sheets[0].rows).toHaveLength(3);
    expect(result.sheets[0].rows[1]).toEqual(["Apple", "line 1 line 2", "10"]);
    expect(result.sheets[0].rows[2]).toEqual(["Microsoft", "single line", "5"]);
  });

  it("parses TSV files", () => {
    const tsv = "name\tquantity\tcurrency\nApple\t10\tUSD\n";
    const dataUrl = `data:text/tab-separated-values;base64,${Buffer.from(tsv, "utf8").toString("base64")}`;

    const result = parseTabularFileFromDataUrl({
      dataUrl,
      mediaType: "text/tab-separated-values",
      filename: "positions.tsv",
    });

    expect(result.kind).toBe("tsv");
    expect(result.sheets[0].rows[1]).toEqual(["Apple", "10", "USD"]);
  });

  it("parses XLSX files", () => {
    const workbookBuffer = createWorkbookBuffer("xlsx", "Positions", [
      ["name", "quantity", "currency"],
      ["Apple", 10, "USD"],
    ]);
    const dataUrl = toDataUrlFromBuffer(
      workbookBuffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const result = parseTabularFileFromDataUrl({
      dataUrl,
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "positions.xlsx",
    });

    expect(result.kind).toBe("xlsx");
    expect(result.sheets[0].rows[1]).toEqual(["Apple", "10", "USD"]);
  });

  it("parses XLS files", () => {
    const workbookBuffer = createWorkbookBuffer("xls", "Positions", [
      ["name", "quantity", "currency"],
      ["Apple", 10, "USD"],
    ]);
    const dataUrl = toDataUrlFromBuffer(
      workbookBuffer,
      "application/vnd.ms-excel",
    );

    const result = parseTabularFileFromDataUrl({
      dataUrl,
      mediaType: "application/vnd.ms-excel",
      filename: "positions.xls",
    });

    expect(result.kind).toBe("xls");
    expect(result.sheets[0].rows[1]).toEqual(["Apple", "10", "USD"]);
  });

  it("expands merged cells", () => {
    const workbookBuffer = createWorkbookBuffer(
      "xlsx",
      "Positions",
      [
        ["Header", ""],
        ["name", "quantity"],
      ],
      { merges: ["A1:B1"] },
    );
    const dataUrl = toDataUrlFromBuffer(
      workbookBuffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const result = parseTabularFileFromDataUrl({
      dataUrl,
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "merged.xlsx",
    });

    expect(result.sheets[0].rows[0]).toEqual(["Header", "Header"]);
  });

  it("uses formula text when computed value is unavailable", () => {
    const workbookBuffer = createWorkbookBuffer(
      "xlsx",
      "Positions",
      [
        ["quantity", "unit_value"],
        [10, ""],
      ],
      {
        formulaCell: {
          address: "B2",
          formula: "A2*2",
        },
      },
    );
    const dataUrl = toDataUrlFromBuffer(
      workbookBuffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const result = parseTabularFileFromDataUrl({
      dataUrl,
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "formula.xlsx",
    });

    expect(result.sheets[0].rows[1][1]).toBe("=A2*2");
    expect(result.warnings.join(" ")).toContain("formula cells");
  });

  it("throws for files larger than maxBytes", () => {
    const csv = "name,quantity,currency\nApple,10,USD\n";
    const dataUrl = `data:text/csv;base64,${Buffer.from(csv, "utf8").toString("base64")}`;

    expect(() =>
      parseTabularFileFromDataUrl({
        dataUrl,
        mediaType: "text/csv",
        filename: "positions.csv",
        maxBytes: 5,
      }),
    ).toThrow(TabularFileError);
  });
});

describe("selectBestSheet", () => {
  it("selects the highest scoring sheet and emits a selection warning", () => {
    const result = selectBestSheet(
      [
        { name: "Summary", rows: [["a"], ["b"]] },
        { name: "Positions", rows: [["name", "quantity"]] },
      ],
      (sheet) => {
        if (sheet.name === "Positions") {
          return {
            score: 100,
            confidence: "high" as const,
            metadata: { headerRowIndex: 0 },
          };
        }

        return {
          score: 10,
          confidence: "low" as const,
          metadata: { headerRowIndex: 0 },
        };
      },
    );

    expect(result.sheet.name).toBe("Positions");
    expect(result.warnings.join(" ")).toContain('Selected sheet "Positions"');
  });
});

describe("serializers", () => {
  it("serializes rows to CSV and limits AI table text", () => {
    const csv = rowsToCsv([
      ["name", "description"],
      ["Apple", 'Cash "Reserve", Bucket'],
    ]);

    expect(csv).toContain('"Cash ""Reserve"", Bucket"');

    const aiTable = buildAiTableText(
      [
        ["name", "quantity", "currency"],
        ["Apple", "10", "USD"],
      ],
      { maxRows: 1, maxColumns: 2 },
    );

    expect(aiTable.text).toBe("name\tquantity");
    expect(aiTable.warnings.length).toBeGreaterThan(0);
  });
});
