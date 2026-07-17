import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";
import { parseNumberStrict } from "@/lib/import/shared/number-parser";

import { assignFileOrderExecutedAt } from "../adapter-utils";
import { normalizeBrokerHeader, parseBrokerTransactionCSVTable } from "../csv";

import type {
  BrokerTransactionAdapter,
  BrokerTransactionImportResult,
  BrokerTransactionPositionDraft,
  BrokerTransactionRecordDraft,
} from "../types";

const SOURCE = "scalable_capital";
const DISPLAY_NAME = "Scalable Capital";
// Detection matches the core columns so that even column-stripped files
// (e.g. edited in a spreadsheet) are still recognized as Scalable exports —
// other import flows rely on detection to route broker CSVs away from the
// positions importer. Parsing then requires the genuine full column set and
// rejects stripped files with an actionable error instead of importing
// degraded data.
const CORE_HEADERS = [
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
const FULL_EXPORT_HEADERS = [
  ...CORE_HEADERS,
  "time",
  "status",
  "reference",
  "assettype",
];
// Savings plan executions are scheduled buys of the same instrument.
const BUY_TYPES = new Set(["buy", "savings plan"]);
const SELL_TYPES = new Set(["sell"]);
const TIME_PATTERN = /^\d{2}:\d{2}:\d{2}$/;
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

// Execution time orders same-day trades; the timezone is irrelevant because
// it is only compared within one export. The shape regex alone is not enough:
// out-of-range values like "99:99:99" build an Invalid Date whose
// toISOString() throws, so those fall back to file-order synthesis instead.
function parseExecutedAt(dateKey: string, timeRaw: string): string | undefined {
  if (!TIME_PATTERN.test(timeRaw)) return undefined;

  const executed = new Date(`${dateKey}T${timeRaw}.000Z`);
  return Number.isNaN(executed.getTime()) ? undefined : executed.toISOString();
}

function hasHeaders(headers: string[], requiredHeaders: string[]): boolean {
  const normalizedHeaders = new Set(headers.map(normalizeBrokerHeader));
  return requiredHeaders.every((header) => normalizedHeaders.has(header));
}

function detectScalableCapitalCSV(csvContent: string): boolean {
  const parsedTable = parseBrokerTransactionCSVTable(csvContent);
  return (
    parsedTable.success && hasHeaders(parsedTable.table.headers, CORE_HEADERS)
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

    if (!hasHeaders(parsedTable.table.headers, CORE_HEADERS)) {
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

    if (!hasHeaders(parsedTable.table.headers, FULL_EXPORT_HEADERS)) {
      return {
        success: false,
        source: SOURCE,
        positions: [],
        records: [],
        ignoredRowCount: 0,
        duplicateTransactionIdCount: 0,
        errors: [
          "This Scalable Capital CSV is missing the time, status, reference, or assetType columns, so it looks like it was edited after export. Download a fresh transaction CSV from Scalable Capital and upload it unmodified.",
        ],
      };
    }

    const positionsByKey = new Map<string, BrokerTransactionPositionDraft>();
    const records: BrokerTransactionRecordDraft[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenTransactionIds = new Set<string>();
    let ignoredNonExecutedRowCount = 0;
    let ignoredNonTradeRowCount = 0;
    let duplicateTransactionIdCount = 0;
    let importedRowsWithFeesOrTaxes = 0;

    for (const row of parsedTable.table.rows) {
      // Cancelled and pending orders share the trade types but never settled.
      const status = row.get("status").trim().toLowerCase();
      if (status !== "executed") {
        ignoredNonExecutedRowCount++;
        continue;
      }

      // Scalable Capital exports deposits, withdrawals, dividends, interest,
      // and fees in the same file. V1 imports only position-changing trades.
      const rawType = row.get("type").trim().toLowerCase();
      if (!BUY_TYPES.has(rawType) && !SELL_TYPES.has(rawType)) {
        ignoredNonTradeRowCount++;
        continue;
      }

      const externalTransactionId = row.get("reference").trim();
      if (!externalTransactionId) {
        errors.push(`Row ${row.rowNumber}: Missing reference`);
        continue;
      }

      if (seenTransactionIds.has(externalTransactionId)) {
        duplicateTransactionIdCount++;
        continue;
      }
      seenTransactionIds.add(externalTransactionId);

      const name = row.get("description").trim();
      const isin = row.get("isin").trim().toUpperCase();
      const dateRaw = row.get("date").trim();
      const timeRaw = row.get("time").trim();
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
        // Records carry no per-row currency, so one instrument trading in two
        // currencies within a file cannot be priced safely.
        if (existingPosition.currency !== currency) {
          errors.push(
            `Row ${row.rowNumber}: "${name}" mixes trade currencies (${existingPosition.currency} and ${currency}), which is not supported yet`,
          );
          continue;
        }
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
        external_transaction_id: externalTransactionId,
        sourceRowNumber: row.rowNumber,
        executedAt: parseExecutedAt(normalizedDate, timeRaw),
      });
    }

    // Fall back to file-order synthesis when any execution time was missing
    // or malformed, so same-day ordering stays consistent across all records.
    if (records.some((record) => !record.executedAt)) {
      assignFileOrderExecutedAt(records);
    }

    const ignoredRowCount =
      ignoredNonExecutedRowCount + ignoredNonTradeRowCount;

    if (ignoredNonExecutedRowCount > 0) {
      warnings.push(
        `Ignored ${ignoredNonExecutedRowCount} Scalable Capital row(s) that were not executed (cancelled or pending orders).`,
      );
    }

    if (ignoredNonTradeRowCount > 0) {
      warnings.push(
        `Ignored ${ignoredNonTradeRowCount} non-trade Scalable Capital row(s). V1 imports only Buy, Sell, and Savings plan rows; deposits, withdrawals, dividends, interest, fees, and taxes are not imported.`,
      );
    }

    if (duplicateTransactionIdCount > 0) {
      warnings.push(
        `Skipped ${duplicateTransactionIdCount} duplicate reference row(s) in this file.`,
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
