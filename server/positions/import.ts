"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createSymbol } from "@/server/symbols/create";
import { resolveSymbolInput } from "@/server/symbols/resolve";
import { fetchSingleQuote } from "@/server/quotes/fetch";
import { createPosition } from "@/server/positions/create";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";
import { validatePortfolioRecordTimelineWindow } from "@/server/portfolio-records/validate-timeline";
import { resolveBrokerTransactionInstruments } from "@/server/import/broker-transactions/instrument-resolution";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { normalizeCapitalGainsTaxRateToDecimal } from "@/lib/capital-gains-tax-rate";
import { convertCurrency } from "@/lib/currency-conversion";
import { parsePositionsCSV } from "@/lib/import/positions/parse-csv";
import {
  detectBrokerTransactionAdapter,
  parseBrokerTransactionsCSV,
} from "@/lib/import/broker-transactions/registry";
import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";

import type { ImportActionResult } from "@/lib/import/shared/types";
import type { PortfolioRecord } from "@/types/global.types";
import type {
  BrokerTransactionImportPreview,
  BrokerTransactionImportRequestOptions,
} from "@/server/import/broker-transactions/instrument-resolution";
import type {
  BrokerTransactionPositionDraft,
  BrokerTransactionRecordDraft,
} from "@/lib/import/broker-transactions/types";
import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";

function normalizePositionName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildCreatePositionFormData(
  draft: BrokerTransactionPositionDraft,
  symbolId?: string,
) {
  const formData = new FormData();
  formData.append("type", "asset");
  formData.append("name", draft.name);
  formData.append("currency", draft.currency);
  formData.append("category_id", draft.category_id);
  // Broker transaction imports derive real quantity from records. This zero
  // snapshot gives recalculation a clean base before the first imported trade.
  formData.append("quantity", "0");
  formData.append("unit_value", String(draft.firstUnitValue));
  formData.append("cost_basis_per_unit", String(draft.firstUnitValue));
  formData.append("date", draft.earliestTradeDate);
  formData.append(
    "description",
    `Imported from broker transaction history (${draft.brokerSymbol ?? "no symbol"})`,
  );
  if (symbolId) {
    formData.append("symbolLookup", symbolId);
  }
  return formData;
}

async function importBrokerTransactionsFromCSV(
  csvContent: string,
  options: BrokerTransactionImportRequestOptions = {},
): Promise<ImportActionResult> {
  const parsed = await parseBrokerTransactionsCSV(csvContent);
  if (!parsed.success || !parsed.source) {
    return {
      success: false,
      error: (parsed.errors ?? ["Failed to parse broker transaction CSV"]).join(
        "\n",
      ),
    };
  }

  if (parsed.records.length === 0) {
    return {
      success: false,
      error: "No supported buy or sell transactions were found in this CSV.",
    };
  }

  const duplicatePositionNames = findDuplicateParsedPositionNames(
    parsed.positions,
  );
  if (duplicatePositionNames.length > 0) {
    return {
      success: false,
      error:
        "Cannot import broker transactions because multiple instruments resolve to the same position name: " +
        duplicatePositionNames.join(", "),
    };
  }

  const { supabase, user } = await getCurrentUser();
  const { data: existingPositions, error: positionsError } = await supabase
    .from("positions")
    .select("id, name, currency")
    .eq("user_id", user.id)
    .eq("type", "asset")
    .is("archived_at", null);

  if (positionsError) {
    return {
      success: false,
      error: `Failed to fetch existing positions: ${positionsError.message}`,
    };
  }

  const positionByNormalizedName = new Map<
    string,
    { id: string; name: string; currency: string }
  >();
  const duplicateExistingNames = new Set<string>();
  for (const position of existingPositions ?? []) {
    const normalized = normalizePositionName(position.name);
    const existing = positionByNormalizedName.get(normalized);
    if (existing && existing.id !== position.id) {
      duplicateExistingNames.add(position.name);
      duplicateExistingNames.add(existing.name);
      continue;
    }
    positionByNormalizedName.set(normalized, position);
  }

  if (duplicateExistingNames.size > 0) {
    return {
      success: false,
      error:
        "Cannot import broker transactions. Multiple active positions share the same name when compared case-insensitively: " +
        Array.from(duplicateExistingNames).join(", "),
    };
  }

  const missingPositions = parsed.positions.filter(
    (position) =>
      !positionByNormalizedName.has(normalizePositionName(position.name)),
  );
  const instrumentResolutions = await resolveBrokerTransactionInstruments({
    positions: missingPositions,
    importSource: parsed.source,
    selectedSymbolTickers: options.selectedSymbolTickers,
  });
  const manualPositionKeys = new Set(options.manualPositionKeys ?? []);
  const reviewRequired = Array.from(instrumentResolutions.values()).filter(
    (resolution) =>
      resolution.state !== "auto_linked" &&
      !manualPositionKeys.has(resolution.positionKey),
  );

  if (reviewRequired.length > 0) {
    return {
      success: false,
      error:
        "Symbol review is required before importing these broker transactions:\n" +
        reviewRequired
          .map((resolution) => `- ${resolution.warning}`)
          .join("\n"),
    };
  }

  const targetCurrencyByPositionKey = buildBrokerTargetCurrencyMap({
    positions: parsed.positions,
    positionByNormalizedName,
    instrumentResolutions,
    manualPositionKeys,
  });
  const conversion = await convertBrokerImportCurrencies({
    positions: parsed.positions,
    records: parsed.records,
    targetCurrencyByPositionKey,
  });
  if (!conversion.success) {
    return {
      success: false,
      error: conversion.error,
    };
  }
  const positionDraftByKey = new Map(
    conversion.positions.map((position) => [position.positionKey, position]),
  );

  for (const draft of missingPositions) {
    const convertedDraft = positionDraftByKey.get(draft.positionKey) ?? draft;
    const resolution = instrumentResolutions.get(draft.positionKey);
    const symbolId =
      resolution?.state === "auto_linked" && resolution.symbolId
        ? resolution.symbolId
        : undefined;
    const result = await createPosition(
      buildCreatePositionFormData(convertedDraft, symbolId),
    );
    if (!result.success) {
      return {
        success: false,
        error: `Failed to create position "${draft.name}": ${result.message}`,
      };
    }
  }

  const nameToPosition = await fetchActivePositionIdsByName();
  const positionIdByPositionKey = new Map<string, string>();
  for (const position of parsed.positions) {
    const entry = nameToPosition.get(normalizePositionName(position.name));
    if (!entry) {
      return {
        success: false,
        error: `Position "${position.name}" was not found after creation.`,
      };
    }
    positionIdByPositionKey.set(position.positionKey, entry.id);
  }

  const existingTransactionIds = await fetchExistingExternalTransactionIds({
    importSource: parsed.source,
    records: conversion.records,
  });
  const recordsToImport = conversion.records.filter(
    (record) => !existingTransactionIds.has(record.external_transaction_id),
  );

  if (recordsToImport.length === 0) {
    revalidatePath("/dashboard", "layout");
    return {
      success: true,
      importedCount: 0,
      createdPositionCount: missingPositions.length,
      matchedPositionCount: parsed.positions.length - missingPositions.length,
      skippedCount: conversion.records.length,
      warnings: buildBrokerImportWarnings(
        [...(parsed.warnings ?? []), ...conversion.warnings],
        instrumentResolutions,
      ),
    };
  }

  const prepared = prepareBrokerRecords({
    records: recordsToImport,
    positionIdByPositionKey,
  });

  const validation = await validatePreparedBrokerRecords(prepared);
  if (!validation.success) return validation;

  const { data: inserted, error: insertError } = await supabase
    .from("portfolio_records")
    .insert(
      prepared.recordsToInsert.map((record) => ({
        user_id: user.id,
        ...record,
      })),
    )
    .select("id, position_id, date");

  if (insertError) {
    return {
      success: false,
      error: `Failed to insert broker transaction records: ${insertError.message}`,
    };
  }

  if (!inserted || inserted.length === 0) {
    return {
      success: false,
      error: "No broker transaction records were inserted",
    };
  }

  const recalculation = await recalculateImportedRecordSnapshots(inserted);
  if (!recalculation.success) return recalculation;

  revalidatePath("/dashboard", "layout");
  return {
    success: true,
    importedCount: inserted.length,
    createdPositionCount: missingPositions.length,
    matchedPositionCount: parsed.positions.length - missingPositions.length,
    skippedCount: conversion.records.length - recordsToImport.length,
    warnings: buildBrokerImportWarnings(
      [...(parsed.warnings ?? []), ...conversion.warnings],
      instrumentResolutions,
    ),
  };
}

function buildBrokerTargetCurrencyMap({
  positions,
  positionByNormalizedName,
  instrumentResolutions,
  manualPositionKeys,
}: {
  positions: BrokerTransactionPositionDraft[];
  positionByNormalizedName: Map<
    string,
    { id: string; name: string; currency: string }
  >;
  instrumentResolutions: Awaited<
    ReturnType<typeof resolveBrokerTransactionInstruments>
  >;
  manualPositionKeys: Set<string>;
}) {
  const targetCurrencyByPositionKey = new Map<string, string>();

  for (const position of positions) {
    const existingPosition = positionByNormalizedName.get(
      normalizePositionName(position.name),
    );
    if (existingPosition) {
      targetCurrencyByPositionKey.set(
        position.positionKey,
        existingPosition.currency,
      );
      continue;
    }

    if (manualPositionKeys.has(position.positionKey)) {
      targetCurrencyByPositionKey.set(position.positionKey, position.currency);
      continue;
    }

    const resolution = instrumentResolutions.get(position.positionKey);
    const selectedCandidate =
      resolution?.state === "auto_linked"
        ? resolution.candidates.find(
            (candidate) => candidate.ticker === resolution.selectedTicker,
          )
        : undefined;
    targetCurrencyByPositionKey.set(
      position.positionKey,
      selectedCandidate?.currency ?? position.currency,
    );
  }

  return targetCurrencyByPositionKey;
}

async function convertBrokerImportCurrencies({
  positions,
  records,
  targetCurrencyByPositionKey,
}: {
  positions: BrokerTransactionPositionDraft[];
  records: BrokerTransactionRecordDraft[];
  targetCurrencyByPositionKey: Map<string, string>;
}): Promise<
  | {
      success: true;
      positions: BrokerTransactionPositionDraft[];
      records: BrokerTransactionRecordDraft[];
      warnings: string[];
    }
  | { success: false; error: string }
> {
  const sourceCurrencyByPositionKey = new Map(
    positions.map((position) => [position.positionKey, position.currency]),
  );
  const fxRequests = new Map<string, { currency: string; date: Date }>();
  const addFxRequest = (currency: string, dateKey: string) => {
    fxRequests.set(`${currency}|${dateKey}`, {
      currency,
      date: parseUTCDateKey(dateKey),
    });
  };

  for (const position of positions) {
    const targetCurrency =
      targetCurrencyByPositionKey.get(position.positionKey) ??
      position.currency;
    if (targetCurrency === position.currency) continue;
    addFxRequest(position.currency, position.earliestTradeDate);
    addFxRequest(targetCurrency, position.earliestTradeDate);
  }

  for (const record of records) {
    const sourceCurrency = sourceCurrencyByPositionKey.get(record.positionKey);
    const targetCurrency = targetCurrencyByPositionKey.get(record.positionKey);
    if (
      !sourceCurrency ||
      !targetCurrency ||
      sourceCurrency === targetCurrency
    ) {
      continue;
    }
    addFxRequest(sourceCurrency, record.date);
    addFxRequest(targetCurrency, record.date);
  }

  const exchangeRates =
    fxRequests.size > 0
      ? await fetchExchangeRates(Array.from(fxRequests.values()))
      : new Map<string, number>();
  const missingRates = Array.from(fxRequests.keys()).filter(
    (key) => !exchangeRates.has(key),
  );
  if (missingRates.length > 0) {
    return {
      success: false,
      error: `Missing historical FX rates for broker import: ${missingRates.join(", ")}`,
    };
  }

  let convertedRecordCount = 0;
  const convertedPositions = positions.map((position) => {
    const targetCurrency =
      targetCurrencyByPositionKey.get(position.positionKey) ??
      position.currency;
    if (targetCurrency === position.currency) return position;

    return {
      ...position,
      currency: targetCurrency,
      firstUnitValue: convertCurrency(
        position.firstUnitValue,
        position.currency,
        targetCurrency,
        exchangeRates,
        position.earliestTradeDate,
      ),
    };
  });

  const convertedRecords = records.map((record) => {
    const sourceCurrency = sourceCurrencyByPositionKey.get(record.positionKey);
    const targetCurrency = targetCurrencyByPositionKey.get(record.positionKey);
    if (
      !sourceCurrency ||
      !targetCurrency ||
      sourceCurrency === targetCurrency
    ) {
      return record;
    }

    convertedRecordCount++;
    return {
      ...record,
      unit_value: convertCurrency(
        record.unit_value,
        sourceCurrency,
        targetCurrency,
        exchangeRates,
        record.date,
      ),
    };
  });

  return {
    success: true,
    positions: convertedPositions,
    records: convertedRecords,
    warnings:
      convertedRecordCount > 0
        ? [
            `Converted ${convertedRecordCount} broker record unit value(s) using historical FX rates for their transaction dates.`,
          ]
        : [],
  };
}

function buildBrokerImportWarnings(
  parsedWarnings: string[] | undefined,
  instrumentResolutions: Awaited<
    ReturnType<typeof resolveBrokerTransactionInstruments>
  >,
) {
  const autoLinkedWarnings = Array.from(instrumentResolutions.values())
    .filter((resolution) => resolution.state === "auto_linked")
    .map((resolution) => resolution.warning)
    .filter((warning): warning is string => Boolean(warning));

  return [...(parsedWarnings ?? []), ...autoLinkedWarnings];
}

function findDuplicateParsedPositionNames(
  positions: BrokerTransactionPositionDraft[],
) {
  const positionKeyByNormalizedName = new Map<string, string>();
  const nameByNormalizedName = new Map<string, string>();
  const duplicates = new Set<string>();

  for (const position of positions) {
    const normalized = normalizePositionName(position.name);
    const existingPositionKey = positionKeyByNormalizedName.get(normalized);
    const existingName = nameByNormalizedName.get(normalized);
    if (existingPositionKey && existingPositionKey !== position.positionKey) {
      if (existingName) duplicates.add(existingName);
      duplicates.add(position.name);
      continue;
    }
    positionKeyByNormalizedName.set(normalized, position.positionKey);
    nameByNormalizedName.set(normalized, position.name);
  }

  return Array.from(duplicates);
}

async function fetchActivePositionIdsByName() {
  const { supabase, user } = await getCurrentUser();
  const { data, error } = await supabase
    .from("positions")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("type", "asset")
    .is("archived_at", null);

  if (error) {
    throw new Error(
      `Failed to fetch positions after creation: ${error.message}`,
    );
  }

  return new Map(
    (data ?? []).map((position) => [
      normalizePositionName(position.name),
      position,
    ]),
  );
}

async function fetchExistingExternalTransactionIds(options: {
  importSource: string;
  records: BrokerTransactionRecordDraft[];
}) {
  const transactionIds = Array.from(
    new Set(options.records.map((record) => record.external_transaction_id)),
  );
  const { supabase, user } = await getCurrentUser();
  const { data, error } = await supabase
    .from("portfolio_records")
    .select("external_transaction_id")
    .eq("user_id", user.id)
    .eq("import_source", options.importSource)
    .in("external_transaction_id", transactionIds);

  if (error) {
    throw new Error(
      `Failed to check existing broker transactions: ${error.message}`,
    );
  }

  return new Set(
    (data ?? [])
      .map((row) => row.external_transaction_id)
      .filter((id): id is string => Boolean(id)),
  );
}

function prepareBrokerRecords({
  records,
  positionIdByPositionKey,
}: {
  records: BrokerTransactionRecordDraft[];
  positionIdByPositionKey: Map<string, string>;
}) {
  const recordsToInsert: Array<
    Pick<
      PortfolioRecord,
      | "position_id"
      | "type"
      | "date"
      | "quantity"
      | "unit_value"
      | "description"
      | "created_at"
      | "import_source"
      | "external_transaction_id"
    >
  > = [];
  const importedTimelineByPosition = new Map<
    string,
    Array<{
      position_id: string;
      type: (typeof PORTFOLIO_RECORD_TYPES)[number];
      date: string;
      quantity: number;
      created_at: string;
      sourceLabel: string;
    }>
  >();
  const earliestImportedDateByPosition = new Map<string, string>();
  const importTimestampBase = Date.now();

  for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
    const record = records[rowIndex];
    const positionId = positionIdByPositionKey.get(record.positionKey);
    if (!positionId) {
      throw new Error(
        `Position not found for record row ${record.sourceRowNumber}`,
      );
    }

    const createdAt = new Date(importTimestampBase + rowIndex).toISOString();
    const timelineRecord = {
      position_id: positionId,
      type: record.type as (typeof PORTFOLIO_RECORD_TYPES)[number],
      date: record.date,
      quantity: record.quantity,
      unit_value: record.unit_value,
      description: record.description,
      created_at: createdAt,
      import_source: record.source,
      external_transaction_id: record.external_transaction_id,
    };

    recordsToInsert.push(timelineRecord);

    const importedForPosition =
      importedTimelineByPosition.get(positionId) ?? [];
    importedForPosition.push({
      ...timelineRecord,
      sourceLabel: `Row ${record.sourceRowNumber}`,
    });
    importedTimelineByPosition.set(positionId, importedForPosition);

    const earliestDate = earliestImportedDateByPosition.get(positionId);
    if (!earliestDate || record.date < earliestDate) {
      earliestImportedDateByPosition.set(positionId, record.date);
    }
  }

  return {
    recordsToInsert,
    importedTimelineByPosition,
    earliestImportedDateByPosition,
  };
}

async function validatePreparedBrokerRecords(
  prepared: ReturnType<typeof prepareBrokerRecords>,
): Promise<ImportActionResult> {
  const { supabase, user } = await getCurrentUser();
  const affectedPositionIds = Array.from(
    prepared.earliestImportedDateByPosition.keys(),
  );
  const globalEarliestImportedDate = Array.from(
    prepared.earliestImportedDateByPosition.values(),
  ).sort()[0];

  if (affectedPositionIds.length === 0 || !globalEarliestImportedDate) {
    return { success: true, importedCount: 0 };
  }

  const { data: existingAffectedRecords, error: existingAffectedRecordsError } =
    await supabase
      .from("portfolio_records")
      .select("id, position_id, type, date, quantity, created_at")
      .eq("user_id", user.id)
      .in("position_id", affectedPositionIds)
      .gte("date", globalEarliestImportedDate);

  if (existingAffectedRecordsError) {
    return {
      success: false,
      error:
        existingAffectedRecordsError.message ??
        "Failed to validate imported broker transaction timelines",
    };
  }

  type ExistingTimelineRecord = {
    id: string;
    position_id: string;
    type: (typeof PORTFOLIO_RECORD_TYPES)[number];
    date: string;
    quantity: number;
    created_at: string;
  };

  const existingRecordsByPosition = new Map<string, ExistingTimelineRecord[]>();
  for (const record of existingAffectedRecords ?? []) {
    const positionEarliestDate = prepared.earliestImportedDateByPosition.get(
      record.position_id,
    );
    if (!positionEarliestDate || record.date < positionEarliestDate) continue;

    const list = existingRecordsByPosition.get(record.position_id) ?? [];
    list.push(record);
    existingRecordsByPosition.set(record.position_id, list);
  }

  for (const positionId of affectedPositionIds) {
    const timelineValidation = await validatePortfolioRecordTimelineWindow({
      supabase,
      userId: user.id,
      positionId,
      records: [
        ...(existingRecordsByPosition.get(positionId) ?? []),
        ...(prepared.importedTimelineByPosition.get(positionId) ?? []),
      ],
    });

    if (!timelineValidation.valid) {
      return {
        success: false,
        error: timelineValidation.message,
      };
    }
  }

  return { success: true, importedCount: prepared.recordsToInsert.length };
}

async function recalculateImportedRecordSnapshots(
  inserted: Array<{ position_id: string; date: string }>,
): Promise<ImportActionResult> {
  const positionDateMap = new Map<string, Date>();
  for (const record of inserted) {
    const date = new Date(record.date);
    const existing = positionDateMap.get(record.position_id);
    if (!existing || date < existing) {
      positionDateMap.set(record.position_id, date);
    }
  }

  const positionIds = Array.from(positionDateMap.keys());
  const globalEarliest = new Date(
    Math.min(
      ...Array.from(positionDateMap.values()).map((date) => date.getTime()),
    ),
  );

  const { supabase } = await getCurrentUser();
  const { data: updates } = await supabase
    .from("portfolio_records")
    .select("position_id, date")
    .eq("type", "update")
    .in("position_id", positionIds)
    .gte("date", formatUTCDateKey(globalEarliest));

  const updatesByPosition = new Map<string, Date[]>();
  for (const updateRecord of updates ?? []) {
    const list = updatesByPosition.get(updateRecord.position_id) ?? [];
    list.push(new Date(updateRecord.date));
    updatesByPosition.set(updateRecord.position_id, list);
  }

  // Reuse the same recalculation boundaries as the normal record importer so
  // imported broker records produce the same snapshot history as manual records.
  for (const [positionId, earliestDate] of positionDateMap.entries()) {
    const dates = [
      earliestDate,
      ...(updatesByPosition.get(positionId) ?? []).filter(
        (date) => date.getTime() >= earliestDate.getTime(),
      ),
    ];
    const uniqueSorted = Array.from(
      new Map(dates.map((date) => [date.getTime(), date])).values(),
    ).sort((left, right) => left.getTime() - right.getTime());

    for (const startDate of uniqueSorted) {
      const recalculationResult = await recalculateSnapshotsUntilNextUpdate({
        positionId,
        fromDate: startDate,
      });

      if (!recalculationResult.success) {
        return {
          success: false,
          error: `Failed to recalculate snapshots for position ${positionId}`,
        };
      }
    }
  }

  return { success: true, importedCount: inserted.length };
}

export async function importPositionsFromCSV(
  csvContent: string,
  positionType: "asset" | "liability" = "asset",
  options: { broker?: BrokerTransactionImportRequestOptions } = {},
): Promise<ImportActionResult> {
  try {
    if (positionType !== "asset") {
      return {
        success: false,
        error: "Only asset imports are supported right now",
      };
    }

    const brokerAdapter = detectBrokerTransactionAdapter(csvContent);
    if (brokerAdapter) {
      return await importBrokerTransactionsFromCSV(csvContent, options.broker);
    }

    // 1) Parse and validate CSV (shared logic)
    const parsed = await parsePositionsCSV(csvContent);
    if (!parsed.success) {
      return {
        success: false,
        error: (parsed.errors ?? ["Failed to parse CSV"]).join("\n"),
      };
    }
    const rows = parsed.positions;

    // 2) Check duplicate names in positions
    const { supabase, user } = await getCurrentUser();
    const names = rows.map((p) => p.name);
    const { data: existing, error: dupErr } = await supabase
      .from("positions")
      .select("name")
      .eq("user_id", user.id)
      .eq("type", "asset")
      .is("archived_at", null)
      .in("name", names);

    if (dupErr) {
      return {
        success: false,
        error: `Failed duplicate check: ${dupErr.message}`,
      };
    }
    if (existing && existing.length > 0) {
      const list = existing.map((e) => e.name).join(", ");
      return {
        success: false,
        error: `Cannot import: the following position name(s) already exist: ${list}. Please rename them in your CSV and try again.`,
      };
    }

    // 3) Import each position
    for (const row of rows) {
      let unitValue = row.unit_value;

      // If symbol present and unit_value missing, try to create symbol and fetch quote
      let canonicalSymbolId: string | null = null;
      const rawSymbolInput = row.symbolLookup?.trim() ?? "";

      if (rawSymbolInput !== "") {
        const resolved = await resolveSymbolInput(rawSymbolInput);

        if (resolved?.symbol?.id) {
          canonicalSymbolId = resolved.symbol.id;
        } else {
          const creationResult = await createSymbol(rawSymbolInput);
          if (!creationResult.success || !creationResult.data?.id) {
            return {
              success: false,
              error: `Failed to create symbol ${rawSymbolInput}: ${creationResult.message}`,
            };
          }

          const postCreateResolved = await resolveSymbolInput(rawSymbolInput);
          if (!postCreateResolved?.symbol?.id) {
            return {
              success: false,
              error: `Symbol ${rawSymbolInput} was created but could not be resolved to a canonical identifier`,
            };
          }

          canonicalSymbolId = postCreateResolved.symbol.id;
        }

        if (unitValue == null) {
          try {
            unitValue = await fetchSingleQuote(
              canonicalSymbolId ?? rawSymbolInput,
            );
          } catch {
            // Keep unitValue as null and let validation handle it
          }
        }
      }

      // For non-symbol imports, unit_value must be present and valid
      if (
        rawSymbolInput === "" &&
        (unitValue == null || !Number.isFinite(unitValue))
      ) {
        return {
          success: false,
          error: `Missing unit value for "${row.name}". Provide unit_value in CSV or provide a recognizable symbol to fetch price automatically.`,
        };
      }

      // 4) Delegate to existing server action (ensures sources hub + snapshot creation)
      const formData = new FormData();
      formData.append("type", "asset");
      formData.append("name", row.name);
      formData.append("currency", row.currency);
      formData.append("category_id", row.category_id);
      formData.append("quantity", String(row.quantity));
      formData.append("unit_value", unitValue != null ? String(unitValue) : "");
      formData.append(
        "symbolLookup",
        canonicalSymbolId ?? rawSymbolInput ?? "",
      );
      formData.append(
        "cost_basis_per_unit",
        row.cost_basis_per_unit != null ? String(row.cost_basis_per_unit) : "",
      );
      const capitalGainsTaxRate = normalizeCapitalGainsTaxRateToDecimal(
        row.capital_gains_tax_rate,
      );
      if (Number.isNaN(capitalGainsTaxRate)) {
        return {
          success: false,
          error: `Invalid capital gains tax rate for "${row.name}". Use a value between 0 and 100 (or 0 to 1 as decimal).`,
        };
      }
      formData.append(
        "capital_gains_tax_rate",
        capitalGainsTaxRate != null ? String(capitalGainsTaxRate) : "",
      );
      formData.append("description", row.description ?? "");

      const result = await createPosition(formData);
      if (!result.success) {
        return {
          success: false,
          error: `Failed to import "${row.name}": ${result.message}`,
        };
      }
    }

    revalidatePath("/dashboard", "layout");
    return { success: true, importedCount: rows.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to import positions",
    };
  }
}

export async function previewBrokerTransactionImport(
  csvContent: string,
): Promise<BrokerTransactionImportPreview> {
  const parsed = await parseBrokerTransactionsCSV(csvContent);
  if (!parsed.success || !parsed.source) {
    return {
      success: false,
      error: (parsed.errors ?? ["Failed to parse broker transaction CSV"]).join(
        "\n",
      ),
    };
  }

  const duplicatePositionNames = findDuplicateParsedPositionNames(
    parsed.positions,
  );
  if (duplicatePositionNames.length > 0) {
    return {
      success: false,
      error:
        "Cannot import broker transactions because multiple instruments resolve to the same position name: " +
        duplicatePositionNames.join(", "),
    };
  }

  const { supabase, user } = await getCurrentUser();
  const { data: existingPositions, error: positionsError } = await supabase
    .from("positions")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("type", "asset")
    .is("archived_at", null);

  if (positionsError) {
    return {
      success: false,
      error: `Failed to fetch existing positions: ${positionsError.message}`,
    };
  }

  const positionByNormalizedName = new Map<
    string,
    { id: string; name: string }
  >();
  for (const position of existingPositions ?? []) {
    positionByNormalizedName.set(
      normalizePositionName(position.name),
      position,
    );
  }

  const positionsToCreate = parsed.positions.filter(
    (position) =>
      !positionByNormalizedName.has(normalizePositionName(position.name)),
  );
  const matchedPositions = parsed.positions.filter((position) =>
    positionByNormalizedName.has(normalizePositionName(position.name)),
  );
  const instrumentResolutions = await resolveBrokerTransactionInstruments({
    positions: positionsToCreate,
    importSource: parsed.source,
    persistMatches: false,
  });
  const existingTransactionIds = await fetchExistingExternalTransactionIds({
    importSource: parsed.source,
    records: parsed.records,
  });

  return {
    success: true,
    source: parsed.source,
    positionsToCreate,
    matchedPositions,
    recordsToImportCount: parsed.records.length - existingTransactionIds.size,
    duplicateRecordsSkippedCount: existingTransactionIds.size,
    ignoredRowCount: parsed.ignoredRowCount,
    warnings: parsed.warnings ?? [],
    resolutions: Array.from(instrumentResolutions.values()),
  };
}
