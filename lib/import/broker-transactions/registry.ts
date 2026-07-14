import { parseBrokerTransactionCSVTable } from "./csv";
import { tradeRepublicAdapter } from "./adapters/trade-republic";

import type {
  BrokerTransactionAdapter,
  BrokerTransactionImportResult,
} from "./types";

const BROKER_TRANSACTION_ADAPTERS: BrokerTransactionAdapter[] = [
  tradeRepublicAdapter,
];

export function detectBrokerTransactionAdapter(
  csvContent: string,
): BrokerTransactionAdapter | null {
  const parsedTable = parseBrokerTransactionCSVTable(csvContent);
  if (!parsedTable.success) return null;

  return (
    BROKER_TRANSACTION_ADAPTERS.find((adapter) =>
      adapter.detect(parsedTable.table.headers),
    ) ?? null
  );
}

export async function parseBrokerTransactionsCSV(
  csvContent: string,
): Promise<BrokerTransactionImportResult> {
  const adapter = detectBrokerTransactionAdapter(csvContent);

  if (!adapter) {
    return {
      success: false,
      source: null,
      positions: [],
      records: [],
      ignoredRowCount: 0,
      duplicateTransactionIdCount: 0,
      errors: ["No supported broker import format matched this file."],
    };
  }

  return adapter.parse(csvContent);
}
