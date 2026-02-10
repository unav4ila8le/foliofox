import { describe, expect, it } from "vitest";

import {
  detectCSVDelimiter,
  parseCSVRowValues,
  splitCSVRecords,
} from "./csv-parser-utils";

describe("splitCSVRecords", () => {
  it("keeps embedded newlines inside quoted cells as a single record", () => {
    const csv = `name,description,quantity
Apple,"line 1
line 2",10
Tesla,"single line",5`;

    const records = splitCSVRecords(csv);

    expect(records).toHaveLength(3);
    expect(records[1]).toBe('Apple,"line 1\nline 2",10');

    const values = parseCSVRowValues(records[1], ",");
    expect(values).toEqual(["Apple", "line 1\nline 2", "10"]);
  });

  it("handles mixed multiline and non-multiline records", () => {
    const csv = `name,description,quantity
Apple,"multiline
description",10
Microsoft,"single line",8
Google,"another
multiline value",6`;

    const records = splitCSVRecords(csv);

    expect(records).toHaveLength(4);
    expect(parseCSVRowValues(records[1], ",")[1]).toBe(
      "multiline\ndescription",
    );
    expect(parseCSVRowValues(records[2], ",")[1]).toBe("single line");
    expect(parseCSVRowValues(records[3], ",")[1]).toBe(
      "another\nmultiline value",
    );
  });

  it("handles escaped quotes with embedded newlines", () => {
    const csv = `name,description
Apple,"line1
""quoted"" line2"`;

    const records = splitCSVRecords(csv);
    const values = parseCSVRowValues(records[1], ",");

    expect(records).toHaveLength(2);
    expect(values[1]).toBe('line1\n"quoted" line2');
  });

  it("normalizes CRLF input while preserving embedded newlines in quoted fields", () => {
    const csv =
      'name,description,quantity\r\nApple,"hello\r\nworld",10\r\nMicrosoft,plain,5\r\n';

    const records = splitCSVRecords(csv).filter((record) => record.length > 0);

    expect(records).toHaveLength(3);
    expect(records[1]).toBe('Apple,"hello\nworld",10');
    expect(parseCSVRowValues(records[1], ",")[1]).toBe("hello\nworld");
  });
});

describe("detectCSVDelimiter", () => {
  it("detects tab delimiter even when data rows contain embedded newlines", () => {
    const tsv = `name\tdescription\tquantity
Apple\t"line 1
line 2"\t10`;

    expect(detectCSVDelimiter(tsv)).toBe("\t");
  });
});
