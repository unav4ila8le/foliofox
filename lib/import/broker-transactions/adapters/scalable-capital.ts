import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";
import { parseNumberStrict } from "@/lib/import/shared/number-parser";

import {
  assignFileOrderExecutedAt,
  createSyntheticTransactionIdFactory,
} from "../adapter-utils";
import { normalizeBrokerHeader, parseBrokerTransactionCSVTable } from "../csv";

import type {
  BrokerTransactionAdapter,
  BrokerTransactionImportResult,
  BrokerTransactionPositionDraft,
  BrokerTransactionRecordDraft,
} from "../types";

const SOURCE = "scalable_capital";
const DISPLAY_NAME = "Scalable Capital";
const REQUIRED_HEADERS = [
  "date",
  "description",
  "type",
  "isin",
  "shares",
  "price",
  "amount",
  "fee",
  "tax",
  "currency",
];
// Savings plan executions are scheduled buys of the same instrument.
const BUY_TYPES = new Set(["buy", "savings plan"]);
const SELL_TYPES = new Set(["sell"]);
const ZERO_EPSILON = 1e-9;

function normalizeKeyPart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildPositionKey(name: string, isin: string): string {
  return `${SOURCE}:${normalizeKeyPart(isin)}:${normalizeKeyPart(name)}`;
}

function normalizeEndingQuantity(quantity: number): number {
  return Math.abs(quantity) < ZERO_EPSILON ? 0 : quantity;
}

function hasNonZeroAmount(rawValue: string): boolean {
  const parsed = parseNumberStrict(rawValue);
  return Number.isFinite(parsed) && parsed !== 0;
}

function hasRequiredScalableCapitalHeaders(headers: string[]): boolean {
  const normalizedHeaders = new Set(headers.map(normalizeBrokerHeader));
  return REQUIRED_HEADERS.every((header) => normalizedHeaders.has(header));
}

function detectScalableCapitalCSV(csvContent: string): boolean {
  const parsedTable = parseBrokerTransactionCSVTable(csvContent);
  return (
    parsedTable.success &&
    hasRequiredScalableCapitalHeaders(parsedTable.table.headers)
  );
}

export const scalableCapitalAdapter: BrokerTransactionAdapter = {
  source: SOURCE,
  displayName: DISPLAY_NAME,
  detect: detectScalableCapitalCSV,
  async parse(csvContent: string): Promise<BrokerTransactionImportResult> {
    const parsedTable = parseBrokerTransactionCSVTable(csvContent);
    if (!parsedTable.success) {
      return {
        success: false,
        source: SOURCE,
        positions: [],
        records: [],
        ignoredRowCount: 0,
        duplicateTransactionIdCount: 0,
        errors: parsedTable.errors,
      };
    }

    if (!hasRequiredScalableCapitalHeaders(parsedTable.table.headers)) {
      return {
        success: false,
        source: SOURCE,
        positions: [],
        records: [],
        ignoredRowCount: 0,
        duplicateTransactionIdCount: 0,
        errors: ["CSV file does not match the Scalable Capital export format"],
      };
    }

    const positionsByKey = new Map<string, BrokerTransactionPositionDraft>();
    const records: BrokerTransactionRecordDraft[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    // Scalable Capital exports have no per-row transaction ID, so IDs are
    // derived from normalized row content for idempotent re-uploads.
    const buildTransactionId = createSyntheticTransactionIdFactory();
    // Every ignored row is a non-trade row for this adapter.
    let ignoredRowCount = 0;
    let importedRowsWithFeesOrTaxes = 0;

    for (const row of parsedTable.table.rows) {
      const rawType = row.get("type").trim().toLowerCase();

      // Scalable Capital exports deposits, withdrawals, dividends, interest,
      // and fees in the same file. V1 imports only position-changing trades.
      if (!BUY_TYPES.has(rawType) && !SELL_TYPES.has(rawType)) {
        ignoredRowCount++;
        continue;
      }

      const name = row.get("description").trim();
      const isin = row.get("isin").trim().toUpperCase();
      const dateRaw = row.get("date").trim();
      const parsedDate = parseUTCDateKey(dateRaw);
      const quantity = Math.abs(parseNumberStrict(row.get("shares")));
      const unitValue = parseNumberStrict(row.get("price"));
      const currency = row.get("currency").trim().toUpperCase();

      if (!name) {
        errors.push(`Row ${row.rowNumber}: Missing description`);
        continue;
      }

      if (!isin) {
        errors.push(`Row ${row.rowNumber}: Missing isin`);
        continue;
      }

      if (Number.isNaN(parsedDate.getTime())) {
        errors.push(`Row ${row.rowNumber}: Invalid date "${dateRaw}"`);
        continue;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(
          `Row ${row.rowNumber}: Invalid shares "${row.get("shares")}"`,
        );
        continue;
      }

      if (!Number.isFinite(unitValue) || unitValue < 0) {
        errors.push(
          `Row ${row.rowNumber}: Invalid price "${row.get("price")}"`,
        );
        continue;
      }

      if (!currency) {
        errors.push(`Row ${row.rowNumber}: Missing currency`);
        continue;
      }

      if (
        hasNonZeroAmount(row.get("fee")) ||
        hasNonZeroAmount(row.get("tax"))
      ) {
        importedRowsWithFeesOrTaxes++;
      }

      const type = SELL_TYPES.has(rawType) ? "sell" : "buy";
      const normalizedDate = formatUTCDateKey(parsedDate);
      const positionKey = buildPositionKey(name, isin);
      const existingPosition = positionsByKey.get(positionKey);
      const signedQuantity = type === "sell" ? -quantity : quantity;

      if (existingPosition) {
        existingPosition.endingQuantity = normalizeEndingQuantity(
          existingPosition.endingQuantity + signedQuantity,
        );
        if (normalizedDate < existingPosition.earliestTradeDate) {
          existingPosition.earliestTradeDate = normalizedDate;
          existingPosition.firstUnitValue = unitValue;
        }
      } else {
        positionsByKey.set(positionKey, {
          positionKey,
          name,
          // The export carries no asset-class column; users can recategorize.
          category_id: "other",
          currency,
          brokerSymbol: isin,
          earliestTradeDate: normalizedDate,
          firstUnitValue: unitValue,
          endingQuantity: normalizeEndingQuantity(signedQuantity),
        });
      }

      records.push({
        source: SOURCE,
        positionKey,
        positionName: name,
        type,
        date: normalizedDate,
        quantity,
        unit_value: unitValue,
        description: null,
        external_transaction_id: buildTransactionId([
          normalizedDate,
          isin,
          type,
          quantity,
          unitValue,
        ]),
        sourceRowNumber: row.rowNumber,
      });
    }

    assignFileOrderExecutedAt(records);

    if (ignoredRowCount > 0) {
      warnings.push(
        `Ignored ${ignoredRowCount} non-trade Scalable Capital row(s). V1 imports only Buy, Sell, and Savings plan rows; deposits, withdrawals, dividends, interest, fees, and taxes are not imported.`,
      );
    }

    if (importedRowsWithFeesOrTaxes > 0) {
      warnings.push(
        `Ignored fee/tax amounts on ${importedRowsWithFeesOrTaxes} imported trade row(s); Foliofox records store quantity and unit price only in v1.`,
      );
    }

    return {
      success: errors.length === 0,
      source: SOURCE,
      positions: Array.from(positionsByKey.values()),
      records,
      ignoredRowCount,
      duplicateTransactionIdCount: 0,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};
