import { describe, it, expect } from "vitest";
import { parseNumberStrict } from "./number-parser";

describe("parseNumberStrict", () => {
  it("should return NaN for non-numeric strings", () => {
    expect(parseNumberStrict("abc")).toBeNaN();
    expect(parseNumberStrict("xyz")).toBeNaN();
    expect(parseNumberStrict("hello")).toBeNaN();
  });

  it("should return NaN for empty strings", () => {
    expect(parseNumberStrict("")).toBeNaN();
    expect(parseNumberStrict("   ")).toBeNaN();
  });

  it("should parse simple integer strings", () => {
    expect(parseNumberStrict("123")).toBe(123);
    expect(parseNumberStrict("0")).toBe(0);
    expect(parseNumberStrict("-45")).toBe(-45);
  });

  it("should parse US format decimals", () => {
    expect(parseNumberStrict("123.45")).toBe(123.45);
    expect(parseNumberStrict("1,234.56")).toBe(1234.56);
    expect(parseNumberStrict("52,673.82")).toBe(52673.82);
  });

  it("should parse EU format decimals", () => {
    expect(parseNumberStrict("123,45")).toBe(123.45);
    expect(parseNumberStrict("1.234,56")).toBe(1234.56);
    expect(parseNumberStrict("52.673,82")).toBe(52673.82);
  });

  it("should handle numbers without thousands separators", () => {
    expect(parseNumberStrict("1234.56")).toBe(1234.56);
    expect(parseNumberStrict("1234,56")).toBe(1234.56);
  });

  it("should parse negative numbers", () => {
    expect(parseNumberStrict("-123.45")).toBe(-123.45);
    expect(parseNumberStrict("-1,234.56")).toBe(-1234.56);
    expect(parseNumberStrict("-1.234,56")).toBe(-1234.56);
  });

  it("should handle numbers with spaces", () => {
    expect(parseNumberStrict(" 123.45 ")).toBe(123.45);
    expect(parseNumberStrict("1 234.56")).toBe(1234.56);
  });

  it("should return NaN for mixed invalid characters", () => {
    expect(parseNumberStrict("12abc34")).toBeNaN();
    expect(parseNumberStrict("1a2b3c4")).toBeNaN();
  });

  it("should handle currency symbols at start or end", () => {
    expect(parseNumberStrict("$100")).toBe(100);
    expect(parseNumberStrict("100$")).toBe(100);
    expect(parseNumberStrict("€123.45")).toBe(123.45);
    expect(parseNumberStrict("123.45€")).toBe(123.45);
    expect(parseNumberStrict("£1,234.56")).toBe(1234.56);
    expect(parseNumberStrict("1.234,56 EUR")).toBe(1234.56);
  });

  it("should handle zero values", () => {
    expect(parseNumberStrict("0")).toBe(0);
    expect(parseNumberStrict("0.0")).toBe(0);
    expect(parseNumberStrict("0,0")).toBe(0);
  });

  it("should return NaN for multiple decimal separators of same type", () => {
    expect(parseNumberStrict("1.2.3")).toBeNaN();
    expect(parseNumberStrict("1,2,3,4")).toBeNaN();
  });

  it("should handle very large numbers", () => {
    expect(parseNumberStrict("1000000.99")).toBe(1000000.99);
    expect(parseNumberStrict("1.000.000,99")).toBe(1000000.99);
    expect(parseNumberStrict("1,000,000")).toBe(1000000);
    expect(parseNumberStrict("1.000.000")).toBe(1000000);
  });
});
