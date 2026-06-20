import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";
import { mapCategory } from "@/lib/import/positions/category-mapper";
import { parseNumberStrict } from "@/lib/import/shared/number-parser";

import { normalizeBrokerHeader, parseBrokerTransactionCSVTable } from "../csv";

import type {
  BrokerTransactionAdapter,
  BrokerTransactionImportResult,
  BrokerTransactionPositionDraft,
  BrokerTransactionRecordDraft,
} from "../types";

const SOURCE = "trade_republic";
const DISPLAY_NAME = "Trade Republic";
const REQUIRED_HEADERS = [
  "datetime",
  "date",
  "category",
  "type",
  "asset_class",
  "name",
  "symbol",
  "shares",
  "price",
  "currency",
  "transaction_id",
];
const ZERO_EPSILON = 1e-9;

function normalizeKeyPart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildPositionKey(name: string, brokerSymbol: string): string {
  const symbolPart = brokerSymbol.trim() || normalizeKeyPart(name);
  return `${SOURCE}:${normalizeKeyPart(symbolPart)}:${normalizeKeyPart(name)}`;
}

function normalizeEndingQuantity(quantity: number): number {
  return Math.abs(quantity) < ZERO_EPSILON ? 0 : quantity;
}

function hasNonZeroAmount(rawValue: string): boolean {
  const parsed = parseNumberStrict(rawValue);
  return Number.isFinite(parsed) && parsed !== 0;
}

function hasRequiredTradeRepublicHeaders(headers: string[]): boolean {
  const normalizedHeaders = new Set(headers.map(normalizeBrokerHeader));
  return REQUIRED_HEADERS.every((header) => normalizedHeaders.has(header));
}

export const tradeRepublicAdapter: BrokerTransactionAdapter = {
  source: SOURCE,
  displayName: DISPLAY_NAME,
  detect: hasRequiredTradeRepublicHeaders,
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

    if (!hasRequiredTradeRepublicHeaders(parsedTable.table.headers)) {
      return {
        success: false,
        source: SOURCE,
        positions: [],
        records: [],
        ignoredRowCount: 0,
        duplicateTransactionIdCount: 0,
        errors: ["CSV file does not match the Trade Republic export format"],
      };
    }

    const positionsByKey = new Map<string, BrokerTransactionPositionDraft>();
    const records: BrokerTransactionRecordDraft[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenTransactionIds = new Set<string>();
    let ignoredRowCount = 0;
    let ignoredNonTradingRowCount = 0;
    let duplicateTransactionIdCount = 0;
    let importedRowsWithFeesOrTaxes = 0;

    for (const row of parsedTable.table.rows) {
      const category = row.get("category").trim().toUpperCase();
      const rawType = row.get("type").trim().toUpperCase();

      // Trade Republic exports cash, dividends, interest, transfers, and card
      // activity in the same file. V1 imports only position-changing trades.
      if (category !== "TRADING" || !["BUY", "SELL"].includes(rawType)) {
        ignoredNonTradingRowCount++;
        ignoredRowCount++;
        continue;
      }

      const externalTransactionId = row.get("transaction_id").trim();
      if (!externalTransactionId) {
        errors.push(`Row ${row.rowNumber}: Missing transaction_id`);
        continue;
      }

      if (seenTransactionIds.has(externalTransactionId)) {
        duplicateTransactionIdCount++;
        ignoredRowCount++;
        continue;
      }
      seenTransactionIds.add(externalTransactionId);

      const name = row.get("name").trim();
      const brokerSymbol = row.get("symbol").trim();
      const datetimeRaw = row.get("datetime").trim();
      const dateRaw = row.get("date").trim();
      const parsedDatetime = new Date(datetimeRaw);
      const parsedDate = parseUTCDateKey(dateRaw);
      const quantity = Math.abs(parseNumberStrict(row.get("shares")));
      const unitValue = parseNumberStrict(row.get("price"));
      const currency = row.get("currency").trim().toUpperCase();

      if (!name) {
        errors.push(`Row ${row.rowNumber}: Missing name`);
        continue;
      }

      if (Number.isNaN(parsedDate.getTime())) {
        errors.push(`Row ${row.rowNumber}: Invalid date "${dateRaw}"`);
        continue;
      }

      if (Number.isNaN(parsedDatetime.getTime())) {
        errors.push(`Row ${row.rowNumber}: Invalid datetime "${datetimeRaw}"`);
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

      const normalizedDate = formatUTCDateKey(parsedDate);
      const positionKey = buildPositionKey(name, brokerSymbol);
      const existingPosition = positionsByKey.get(positionKey);
      const signedQuantity = rawType === "SELL" ? -quantity : quantity;

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
          category_id: mapCategory(row.get("asset_class")),
          currency,
          brokerSymbol: brokerSymbol || null,
          earliestTradeDate: normalizedDate,
          firstUnitValue: unitValue,
          endingQuantity: normalizeEndingQuantity(signedQuantity),
        });
      }

      records.push({
        source: SOURCE,
        positionKey,
        positionName: name,
        type: rawType === "SELL" ? "sell" : "buy",
        date: normalizedDate,
        quantity,
        unit_value: unitValue,
        description: row.get("description").trim() || null,
        external_transaction_id: externalTransactionId,
        sourceRowNumber: row.rowNumber,
        executedAt: parsedDatetime.toISOString(),
      });
    }

    if (ignoredNonTradingRowCount > 0) {
      warnings.push(
        `Ignored ${ignoredNonTradingRowCount} non-trading Trade Republic row(s). V1 imports only BUY and SELL trading rows; cash movements, dividends, interest, fees, and taxes are not imported.`,
      );
    }

    if (duplicateTransactionIdCount > 0) {
      warnings.push(
        `Skipped ${duplicateTransactionIdCount} duplicate transaction_id row(s) in this file.`,
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
      duplicateTransactionIdCount,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};
