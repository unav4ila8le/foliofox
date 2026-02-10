import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImportResults } from "./import-results";

import type { PositionImportResult } from "@/lib/import/positions/types";

function createSuccessResult(warnings: string[] = []): PositionImportResult {
  return {
    success: true,
    positions: [
      {
        name: "Apple Inc",
        category_id: "equity",
        currency: "USD",
        quantity: 10,
        unit_value: 120,
        cost_basis_per_unit: null,
        capital_gains_tax_rate: null,
        symbolLookup: "AAPL",
        description: null,
      },
    ],
    warnings,
  };
}

describe("ImportResults", () => {
  it("shows truncation warnings in a dedicated alert", () => {
    render(
      <ImportResults
        result={createSuccessResult([
          "Only the first 250 rows were sent to AI to keep extraction reliable.",
          'Selected sheet "Positions" for import.',
        ])}
      />,
    );

    expect(screen.getByText("Large Spreadsheet Notice")).toBeDefined();
    expect(
      screen.getByText(
        "Only the first 250 rows were sent to AI to keep extraction reliable.",
      ),
    ).toBeDefined();
    expect(screen.getByText("Warnings")).toBeDefined();
    expect(
      screen.getByText('Selected sheet "Positions" for import.'),
    ).toBeDefined();
  });
});
