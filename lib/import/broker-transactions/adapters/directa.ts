import { parseUTCDateKey } from "@/lib/date/date-utils";
import { parseNumberStrict } from "@/lib/import/shared/number-parser";
import {
  parseCSVRowValues,
  splitCSVRecords,
} from "@/lib/import/shared/csv-parser-utils";

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

const SOURCE = "directa";
const DISPLAY_NAME = "Directa";
// "Quantità" is matched by prefix because a Windows-1252 export decoded as
// UTF-8 mangles the accented character.
const REQUIRED_HEADERS = [
  "data_operazione",
  "tipo_operazione",
  "isin",
  "descrizione",
  "importo_euro",
  "divisa",
];
const BUY_TYPES = new Set(["acquisto"]);
const SELL_TYPES = new Set(["vendita"]);
const FEE_TYPES = new Set(["commissioni"]);
const ZERO_EPSILON = 1e-9;

function normalizeKeyPart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildPositionKey(name: string, isin: string): string {
  const symbolPart = isin.trim() || normalizeKeyPart(name);
  return `${SOURCE}:${normalizeKeyPart(symbolPart)}:${normalizeKeyPart(name)}`;
}

function normalizeEndingQuantity(quantity: number): number {
  return Math.abs(quantity) < ZERO_EPSILON ? 0 : quantity;
}

function isDirectaHeaderRecord(record: string): boolean {
  const headers = parseCSVRowValues(record, ";").map(normalizeBrokerHeader);
  return (
    REQUIRED_HEADERS.every((header) => headers.includes(header)) &&
    headers.some((header) => header.startsWith("quantit"))
  );
}

// Directa "Movimenti" exports start with account metadata lines before the
// real header row, so the adapter locates the header instead of assuming
// it is the first line.
function findHeaderRecordIndex(csvContent: string): number {
  return splitCSVRecords(csvContent).findIndex(isDirectaHeaderRecord);
}

// Directa dates are day-first: direct downloads use dd-mm-yyyy, while
// Excel round-trips of the same export produce dd/mm/yyyy.
function parseDirectaDateKey(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/);
  if (!match) return null;

  const dateKey = `${match[4]}-${match[3].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return Number.isNaN(parseUTCDateKey(dateKey).getTime()) ? null : dateKey;
}

export const directaAdapter: BrokerTransactionAdapter = {
  source: SOURCE,
  displayName: DISPLAY_NAME,
  detect: (csvContent) => findHeaderRecordIndex(csvContent) >= 0,
  async parse(csvContent: string): Promise<BrokerTransactionImportResult> {
    const headerRecordIndex = findHeaderRecordIndex(csvContent);
    if (headerRecordIndex < 0) {
      return {
        success: false,
        source: SOURCE,
        positions: [],
        records: [],
        ignoredRowCount: 0,
        duplicateTransactionIdCount: 0,
        errors: ["CSV file does not match the Directa export format"],
      };
    }

    const parsedTable = parseBrokerTransactionCSVTable(
      splitCSVRecords(csvContent).slice(headerRecordIndex).join("\n"),
    );
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

    // Resolve the possibly mangled quantity header once (see REQUIRED_HEADERS).
    const quantityHeader =
      parsedTable.table.normalizedHeaders.find((header) =>
        header.startsWith("quantit"),
      ) ?? "quantita";
    const positionsByKey = new Map<string, BrokerTransactionPositionDraft>();
    const records: BrokerTransactionRecordDraft[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    // Directa's "Riferimento ordine" is per-order (shared by multiple fills)
    // and is often mangled into scientific notation by Excel round-trips, so
    // IDs are derived from normalized row content instead.
    const buildTransactionId = createSyntheticTransactionIdFactory();
    let ignoredFeeRowCount = 0;
    let ignoredOtherRowCount = 0;

    for (const row of parsedTable.table.rows) {
      // Best-effort mapping of table rows back to original file lines for errors.
      const rowNumber = row.rowNumber + headerRecordIndex;
      const rawType = row.get("tipo_operazione").trim().toLowerCase();

      if (!BUY_TYPES.has(rawType) && !SELL_TYPES.has(rawType)) {
        if (FEE_TYPES.has(rawType)) {
          ignoredFeeRowCount++;
        } else {
          ignoredOtherRowCount++;
        }
        continue;
      }

      const name = row.get("descrizione").trim();
      const isin = row.get("isin").trim().toUpperCase();
      const dateRaw = row.get("data_operazione").trim();
      const dateKey = parseDirectaDateKey(dateRaw);
      const quantity = Math.abs(parseNumberStrict(row.get(quantityHeader)));
      const currency = row.get("divisa").trim().toUpperCase() || "EUR";
      // Trade rows carry gross amounts (fees are separate "Commissioni" rows)
      // and no unit price, so price is derived from amount and quantity.
      // Non-EUR trades store the native amount in "Importo Divisa".
      const amount = parseNumberStrict(
        currency === "EUR"
          ? row.get("importo_euro")
          : row.get("importo_divisa"),
      );

      if (!name) {
        errors.push(`Row ${rowNumber}: Missing descrizione`);
        continue;
      }

      if (!dateKey) {
        errors.push(`Row ${rowNumber}: Invalid date "${dateRaw}"`);
        continue;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(
          `Row ${rowNumber}: Invalid quantity "${row.get(quantityHeader)}"`,
        );
        continue;
      }

      if (!Number.isFinite(amount) || Math.abs(amount) < ZERO_EPSILON) {
        errors.push(
          `Row ${rowNumber}: Invalid amount for currency ${currency}`,
        );
        continue;
      }

      const type = SELL_TYPES.has(rawType) ? "sell" : "buy";
      const unitValue = Math.abs(amount) / quantity;
      const positionKey = buildPositionKey(name, isin);
      const existingPosition = positionsByKey.get(positionKey);
      const signedQuantity = type === "sell" ? -quantity : quantity;

      if (existingPosition) {
        // Records carry no per-row currency, so one instrument trading in two
        // currencies within a file cannot be priced safely.
        if (existingPosition.currency !== currency) {
          errors.push(
            `Row ${rowNumber}: "${name}" mixes trade currencies (${existingPosition.currency} and ${currency}), which is not supported yet`,
          );
          continue;
        }
        existingPosition.endingQuantity = normalizeEndingQuantity(
          existingPosition.endingQuantity + signedQuantity,
        );
        if (dateKey < existingPosition.earliestTradeDate) {
          existingPosition.earliestTradeDate = dateKey;
          existingPosition.firstUnitValue = unitValue;
        }
      } else {
        positionsByKey.set(positionKey, {
          positionKey,
          name,
          // The export carries no asset-class column; users can recategorize.
          category_id: "other",
          currency,
          brokerSymbol: isin || null,
          earliestTradeDate: dateKey,
          firstUnitValue: unitValue,
          endingQuantity: normalizeEndingQuantity(signedQuantity),
        });
      }

      records.push({
        source: SOURCE,
        positionKey,
        positionName: name,
        type,
        date: dateKey,
        quantity,
        unit_value: unitValue,
        description: null,
        external_transaction_id: buildTransactionId([
          dateKey,
          isin || normalizeKeyPart(name),
          type,
          quantity,
          amount,
        ]),
        sourceRowNumber: rowNumber,
      });
    }

    assignFileOrderExecutedAt(records);

    if (ignoredFeeRowCount > 0) {
      warnings.push(
        `Ignored ${ignoredFeeRowCount} Directa commission row(s); Foliofox records store quantity and unit price only in v1.`,
      );
    }

    if (ignoredOtherRowCount > 0) {
      warnings.push(
        `Ignored ${ignoredOtherRowCount} non-trade Directa row(s). V1 imports only Acquisto and Vendita rows.`,
      );
    }

    return {
      success: errors.length === 0,
      source: SOURCE,
      positions: Array.from(positionsByKey.values()),
      records,
      ignoredRowCount: ignoredFeeRowCount + ignoredOtherRowCount,
      duplicateTransactionIdCount: 0,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};
