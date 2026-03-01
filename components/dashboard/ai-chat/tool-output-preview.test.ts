import { describe, expect, it } from "vitest";

import { getToolOutputPreview } from "./tool-output-preview";

describe("getToolOutputPreview", () => {
  it("returns unchanged output for non-heavy tools", () => {
    const output = { price: 123.45 };

    const preview = getToolOutputPreview({
      type: "tool-position-lookup",
      output,
    });

    expect(preview).toEqual(output);
  });

  it("summarizes large outputs for any tool type using the same shape", () => {
    const largeOutput = {
      rows: Array.from({ length: 300 }, (_, index) => ({
        id: index + 1,
        name: `Position-${index + 1}`,
        value: index * 10,
        notes: "x".repeat(150),
      })),
    };

    const preview = getToolOutputPreview({
      type: "tool-any-large-output",
      output: largeOutput,
    });

    expect(preview).toMatchObject({
      truncated: true,
      originalSizeChars: expect.any(Number),
      preview: expect.anything(),
    });
  });

  it("applies the same truncation behavior to quote tools", () => {
    const largeOutput = {
      points: Array.from({ length: 600 }, (_, index) => ({
        date: `2026-03-${String((index % 30) + 1).padStart(2, "0")}`,
        price: index + 1,
      })),
    };

    const preview = getToolOutputPreview({
      type: "tool-getHistoricalQuotesBatch",
      output: largeOutput,
    });

    expect(preview).toMatchObject({
      truncated: true,
      originalSizeChars: expect.any(Number),
      preview: expect.anything(),
    });
  });

  it("keeps concrete nested values in array previews", () => {
    const largeOutput = {
      symbols: [
        {
          points: Array.from({ length: 300 }, (_, index) => ({
            date: `2026-03-${String((index % 30) + 1).padStart(2, "0")}`,
            price: index + 1,
            source: "yahoo-finance",
            status: "ok",
          })),
        },
      ],
    };

    const preview = getToolOutputPreview({
      type: "tool-getHistoricalQuotesBatch",
      output: largeOutput,
    }) as {
      truncated: boolean;
      preview: {
        symbols: Array<{ points: Array<Record<string, unknown> | string> }>;
      };
    };

    expect(preview.truncated).toBe(true);
    const pointsPreview = preview.preview.symbols[0]?.points;
    expect(pointsPreview).toBeDefined();
    expect(pointsPreview?.[0]).toMatchObject({
      date: "2026-03-01",
      price: 1,
      source: "yahoo-finance",
      status: "ok",
    });
  });
});
