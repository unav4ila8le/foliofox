import type { CategoryId } from "@/lib/import/positions/category-mapper";

export interface BrokerTransactionCSVTable {
  headers: string[];
  normalizedHeaders: string[];
  rows: BrokerTransactionCSVRow[];
}

export interface BrokerTransactionCSVRow {
  rowNumber: number;
  values: string[];
  get: (header: string) => string;
}

export interface BrokerTransactionPositionDraft {
  // Stable adapter-local key used to connect parsed records to parsed positions
  // before the server creates or matches real Foliofox position IDs.
  positionKey: string;
  name: string;
  category_id: CategoryId;
  currency: string;
  brokerSymbol: string | null;
  earliestTradeDate: string;
  firstUnitValue: number;
  endingQuantity: number;
}

export interface BrokerTransactionRecordDraft {
  source: string;
  // References BrokerTransactionPositionDraft.positionKey, not a DB ID.
  positionKey: string;
  positionName: string;
  type: "buy" | "sell";
  date: string;
  quantity: number;
  unit_value: number;
  description: string | null;
  external_transaction_id: string;
  sourceRowNumber: number;
  // Broker execution timestamp used to order multiple trades on the same date.
  executedAt?: string;
}

export interface BrokerTransactionImportResult {
  success: boolean;
  source: string | null;
  positions: BrokerTransactionPositionDraft[];
  records: BrokerTransactionRecordDraft[];
  ignoredRowCount: number;
  duplicateTransactionIdCount: number;
  warnings?: string[];
  errors?: string[];
}

export interface BrokerTransactionAdapter {
  // Persisted to portfolio_records.import_source for idempotency.
  source: string;
  displayName: string;
  detect: (headers: string[]) => boolean;
  parse: (csvContent: string) => Promise<BrokerTransactionImportResult>;
}
