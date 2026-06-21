import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BrokerTransactionResults } from "./broker-transaction-results";

import type { BrokerTransactionImportPreview } from "@/server/import/broker-transactions/instrument-resolution";

const preview: Extract<BrokerTransactionImportPreview, { success: true }> = {
  success: true,
  source: "trade_republic",
  positionsToCreate: [
    {
      positionKey: "trade_republic:isin:acme",
      name: "Acme",
      category_id: "equity",
      currency: "EUR",
      brokerSymbol: "US0000000001",
      earliestTradeDate: "2024-01-01",
      firstUnitValue: 10,
      endingQuantity: 2,
    },
    {
      positionKey: "trade_republic:missing:manual",
      name: "Manual Only",
      category_id: "equity",
      currency: "EUR",
      brokerSymbol: "US0000000002",
      earliestTradeDate: "2024-01-01",
      firstUnitValue: 10,
      endingQuantity: 2,
    },
  ],
  matchedPositions: [],
  recordsToImportCount: 2,
  duplicateRecordsSkippedCount: 1,
  ignoredRowCount: 3,
  warnings: ["Ignored cash rows."],
  resolutions: [
    {
      state: "needs_review",
      positionKey: "trade_republic:isin:acme",
      candidates: [
        {
          ticker: "ACME.DE",
          name: "Acme",
          exchange: "GER",
          currency: "EUR",
        },
        {
          ticker: "ACME",
          name: "Acme",
          exchange: "NYQ",
          currency: "USD",
        },
      ],
      warning: "Acme has multiple EUR-quoted symbol candidates.",
    },
    {
      state: "unresolved",
      positionKey: "trade_republic:missing:manual",
      candidates: [],
      warning: "No market symbol candidates were found.",
    },
  ],
};

describe("BrokerTransactionResults", () => {
  it("shows broker counts, symbol review, manual fallback, and warnings", () => {
    render(
      <BrokerTransactionResults
        preview={preview}
        selectedSymbolTickers={{}}
        manualPositionKeys={[]}
        onSelectSymbol={vi.fn()}
        onToggleManual={vi.fn()}
      />,
    );

    expect(screen.getByText("Broker transaction CSV detected")).toBeDefined();
    expect(screen.getByText("Needs symbol review")).toBeDefined();
    expect(screen.getByText("Manual fallback")).toBeDefined();
    expect(screen.getByText("Acme")).toBeDefined();
    expect(screen.getByText(/ISIN US0000000001/)).toBeDefined();
    expect(
      screen.getByText(/All transactions will be converted/),
    ).toBeDefined();
    expect(screen.getByText("Import manually")).toBeDefined();
    expect(screen.getByText("Ignored cash rows.")).toBeDefined();
  });
});
