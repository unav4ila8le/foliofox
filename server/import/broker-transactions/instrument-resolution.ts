"use server";

import { createSymbol } from "@/server/symbols/create";
import {
  resolveSymbolInput,
  upsertSymbolAlias,
} from "@/server/symbols/resolve";
import {
  fetchYahooFinanceSymbol,
  searchYahooFinanceSymbols,
} from "@/server/symbols/search";

import type { BrokerTransactionPositionDraft } from "@/lib/import/broker-transactions/types";
import type { Symbol } from "@/types/global.types";

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
const SYMBOL_SEARCH_LIMIT = 5;
// Broker trades are securities, so fuzzy name-search results outside these
// quote types (futures, FX, indexes) are noise, not candidates.
const NAME_SEARCH_QUOTE_TYPES = new Set([
  "equity",
  "etf",
  "fund",
  "mutual fund",
  "mutualfund",
]);

export interface BrokerInstrumentCandidate {
  ticker: string;
  name: string;
  exchange: string | null;
  currency: string;
  symbolId?: string;
}

export type BrokerInstrumentResolution =
  | {
      state: "auto_linked";
      positionKey: string;
      symbolId: string | null;
      selectedTicker: string;
      candidates: BrokerInstrumentCandidate[];
      warning?: string;
    }
  | {
      state: "needs_review";
      positionKey: string;
      candidates: BrokerInstrumentCandidate[];
      warning: string;
    }
  | {
      state: "unresolved";
      positionKey: string;
      candidates: [];
      warning: string;
    };

export interface BrokerTransactionImportRequestOptions {
  selectedSymbolTickers?: Record<string, string>;
  manualPositionKeys?: string[];
  // Positions skipped during review; they and their records are not imported.
  excludedPositionKeys?: string[];
}

export type BrokerTransactionImportPreview =
  | {
      success: true;
      source: string;
      positionsToCreate: BrokerTransactionPositionDraft[];
      matchedPositions: BrokerTransactionPositionDraft[];
      recordsToImportCount: number;
      duplicateRecordsSkippedCount: number;
      ignoredRowCount: number;
      warnings: string[];
      resolutions: BrokerInstrumentResolution[];
    }
  | {
      success: false;
      error: string;
    };

export async function resolveBrokerTransactionInstruments(options: {
  positions: BrokerTransactionPositionDraft[];
  importSource: string;
  selectedSymbolTickers?: Record<string, string>;
  persistMatches?: boolean;
}) {
  const resolutions = await Promise.all(
    options.positions.map((position) =>
      resolveBrokerTransactionInstrument({
        position,
        importSource: options.importSource,
        selectedTicker: options.selectedSymbolTickers?.[position.positionKey],
        persistMatches: options.persistMatches ?? true,
      }),
    ),
  );

  return new Map(
    resolutions.map((resolution) => [resolution.positionKey, resolution]),
  );
}

async function resolveBrokerTransactionInstrument(options: {
  position: BrokerTransactionPositionDraft;
  importSource: string;
  selectedTicker?: string;
  persistMatches: boolean;
}): Promise<BrokerInstrumentResolution> {
  const { position, importSource, selectedTicker, persistMatches } = options;
  const brokerSymbol = position.brokerSymbol?.trim().toUpperCase() ?? "";
  const isIsin = isIsinLike(brokerSymbol);

  // 1. User review choices win, including for rows without a broker symbol.
  // 2. Broker-scoped ISIN aliases seed candidates. 3. A single ISIN candidate
  // can auto-link; multiple ISIN listings need review because Trade Republic
  // transaction currency is settlement currency.
  if (selectedTicker?.trim()) {
    return resolveSelectedTicker({
      position,
      brokerSymbol,
      importSource,
      isIsin,
      selectedTicker,
      persistMatches,
    });
  }

  if (!brokerSymbol) {
    return unresolved(position, "No broker symbol was provided.");
  }

  const aliasType = isIsin ? "isin" : "ticker";
  const existing = await resolveSymbolInput(brokerSymbol, {
    type: aliasType,
    // ISIN aliases are broker-scoped because an ISIN identifies the security,
    // not the venue/currency-specific market listing we attach to positions.
    source: isIsin ? importSource : undefined,
  });

  if (existing?.symbol && !isIsin) {
    return await resolveExistingSymbol({
      position,
      isIsin,
      symbol: existing.symbol,
    });
  }

  const providerCandidates = await findProviderCandidates({
    brokerSymbol,
    positionName: position.name,
    isIsin,
  });
  const candidates = mergeBrokerInstrumentCandidates([
    ...(existing?.symbol ? [toCandidate(existing.symbol)] : []),
    ...providerCandidates,
  ]);
  if (candidates.length === 0) {
    return unresolved(
      position,
      `No market symbol candidates were found for ${position.name}.`,
    );
  }

  const sameCurrencyCandidates = candidates.filter(
    (candidate) => candidate.currency === position.currency,
  );

  if (isIsin && candidates.length !== 1) {
    return {
      state: "needs_review",
      positionKey: position.positionKey,
      candidates,
      warning:
        sameCurrencyCandidates.length === 0
          ? `${position.name} has symbol candidates, but none are quoted in ${position.currency}.`
          : `${position.name} matches one or more ISIN candidates. Review the listing because one ISIN can trade on multiple venues and currencies.`,
    };
  }

  if (!isIsin && sameCurrencyCandidates.length !== 1) {
    return {
      state: "needs_review",
      positionKey: position.positionKey,
      candidates,
      warning:
        sameCurrencyCandidates.length === 0
          ? `${position.name} has symbol candidates, but none are quoted in ${position.currency}.`
          : `${position.name} has multiple ${position.currency}-quoted symbol candidates.`,
    };
  }

  const selected = isIsin ? candidates[0] : sameCurrencyCandidates[0];
  if (!persistMatches) {
    return {
      state: "auto_linked",
      positionKey: position.positionKey,
      symbolId: null,
      selectedTicker: selected.ticker,
      candidates,
    };
  }

  let symbolId = selected.symbolId ?? null;
  if (!symbolId) {
    const creation = await createSymbol(selected.ticker);
    if (!creation.success || !creation.data?.id) {
      return {
        state: "needs_review",
        positionKey: position.positionKey,
        candidates,
        warning: `Could not create market symbol ${selected.ticker} for ${position.name}.`,
      };
    }
    symbolId = creation.data.id;
  }

  if (isIsin) {
    await upsertSymbolAlias(symbolId, brokerSymbol, {
      source: importSource,
      type: "isin",
    });
  }

  return {
    state: "auto_linked",
    positionKey: position.positionKey,
    symbolId,
    selectedTicker: selected.ticker,
    candidates,
    warning:
      selected.currency !== position.currency
        ? `${position.name} records were converted from ${position.currency} to ${selected.currency}.`
        : undefined,
  };
}

async function resolveSelectedTicker(options: {
  position: BrokerTransactionPositionDraft;
  brokerSymbol: string;
  importSource: string;
  isIsin: boolean;
  selectedTicker: string;
  persistMatches: boolean;
}): Promise<BrokerInstrumentResolution> {
  const {
    position,
    brokerSymbol,
    importSource,
    isIsin,
    selectedTicker,
    persistMatches,
  } = options;
  const normalizedTicker = selectedTicker.trim().toUpperCase();
  const fetched = await fetchYahooFinanceSymbol(normalizedTicker);

  if (!fetched.success || !fetched.data?.currency) {
    return {
      state: "needs_review",
      positionKey: position.positionKey,
      candidates: [],
      warning: `Could not resolve selected symbol ${normalizedTicker} for ${position.name}.`,
    };
  }

  const candidate: BrokerInstrumentCandidate = {
    ticker: fetched.data.ticker,
    name: fetched.data.long_name ?? fetched.data.short_name ?? normalizedTicker,
    exchange: fetched.data.exchange ?? null,
    currency: fetched.data.currency,
  };

  if (!persistMatches) {
    return {
      state: "auto_linked",
      positionKey: position.positionKey,
      symbolId: null,
      selectedTicker: candidate.ticker,
      candidates: [candidate],
      warning:
        candidate.currency !== position.currency
          ? `${position.name} records will be converted from ${position.currency} to ${candidate.currency}.`
          : undefined,
    };
  }

  const creation = await createSymbol(candidate.ticker);
  if (!creation.success || !creation.data?.id) {
    return {
      state: "needs_review",
      positionKey: position.positionKey,
      candidates: [candidate],
      warning: `Could not create selected symbol ${candidate.ticker} for ${position.name}.`,
    };
  }

  if (isIsin) {
    await upsertSymbolAlias(creation.data.id, brokerSymbol, {
      source: importSource,
      type: "isin",
    });
  }

  return {
    state: "auto_linked",
    positionKey: position.positionKey,
    symbolId: creation.data.id,
    selectedTicker: candidate.ticker,
    candidates: [candidate],
    warning:
      candidate.currency !== position.currency
        ? `${position.name} records were converted from ${position.currency} to ${candidate.currency}.`
        : undefined,
  };
}

async function resolveExistingSymbol(options: {
  position: BrokerTransactionPositionDraft;
  isIsin: boolean;
  symbol: Symbol;
}): Promise<BrokerInstrumentResolution> {
  const { position, isIsin, symbol } = options;
  const candidate = toCandidate(symbol);

  if (isIsin) {
    return {
      state: "needs_review",
      positionKey: position.positionKey,
      candidates: [candidate],
      warning: `${position.name} matches saved ISIN alias ${symbol.ticker}. Review the listing because one ISIN can trade on multiple venues and currencies.`,
    };
  }

  if (symbol.currency !== position.currency) {
    return {
      state: "needs_review",
      positionKey: position.positionKey,
      candidates: [candidate],
      warning: `${position.name} resolves to ${symbol.ticker}, but it is quoted in ${symbol.currency} while broker transactions are in ${position.currency}.`,
    };
  }

  return {
    state: "auto_linked",
    positionKey: position.positionKey,
    symbolId: symbol.id,
    selectedTicker: symbol.ticker,
    candidates: [candidate],
  };
}

async function findProviderCandidates(options: {
  brokerSymbol: string;
  positionName: string;
  isIsin: boolean;
}) {
  const queries = [
    options.brokerSymbol,
    ...(options.isIsin ? [options.positionName] : []),
  ];
  const tickers = new Set<string>();

  for (const query of queries) {
    const isNameQuery = query !== options.brokerSymbol;
    const result = await searchYahooFinanceSymbols({
      query,
      limit: SYMBOL_SEARCH_LIMIT,
    });
    if (!result.success) continue;

    for (const match of result.data ?? []) {
      // Exact broker-symbol/ISIN matches pass through unfiltered; only the
      // fuzzy name search is restricted to security quote types.
      if (
        isNameQuery &&
        !NAME_SEARCH_QUOTE_TYPES.has((match.typeDisp ?? "").toLowerCase())
      ) {
        continue;
      }
      tickers.add(match.id.trim().toUpperCase());
    }
  }

  const candidates: BrokerInstrumentCandidate[] = [];
  for (const ticker of tickers) {
    const symbol = await fetchYahooFinanceSymbol(ticker);
    if (!symbol.success || !symbol.data?.currency) continue;

    candidates.push({
      ticker: symbol.data.ticker,
      name: symbol.data.long_name ?? symbol.data.short_name ?? ticker,
      exchange: symbol.data.exchange ?? null,
      currency: symbol.data.currency,
    });
  }

  return candidates;
}

function unresolved(
  position: BrokerTransactionPositionDraft,
  warning: string,
): BrokerInstrumentResolution {
  return {
    state: "unresolved",
    positionKey: position.positionKey,
    candidates: [],
    warning,
  };
}

function toCandidate(symbol: Symbol): BrokerInstrumentCandidate {
  return {
    ticker: symbol.ticker,
    name: symbol.long_name ?? symbol.short_name ?? symbol.ticker,
    exchange: symbol.exchange,
    currency: symbol.currency,
    symbolId: symbol.id,
  };
}

function mergeBrokerInstrumentCandidates(
  candidates: BrokerInstrumentCandidate[],
) {
  const byTicker = new Map<string, BrokerInstrumentCandidate>();
  for (const candidate of candidates) {
    const key = candidate.ticker.trim().toUpperCase();
    if (!byTicker.has(key)) {
      byTicker.set(key, candidate);
    }
  }
  return Array.from(byTicker.values());
}

function isIsinLike(value: string) {
  return ISIN_PATTERN.test(value.trim().toUpperCase());
}
