"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeQuoteToCurrencyRate } from "@/server/market-data/quote-units";
import { chunkArray } from "@/server/shared/chunk-array";
import { createServiceClient } from "@/supabase/service";

import type { Database } from "@/types/database.types";
import type { Symbol, SymbolAlias } from "@/types/global.types";

const DEFAULT_ALIAS_TYPE = "ticker";
const DEFAULT_ALIAS_SOURCE = "yahoo";
const BATCH_QUERY_CHUNK_SIZE = 200;

export type ProviderAliasMode = "active-only" | "display-fallback";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CanonicalSymbol {
  symbol: Symbol;
  primaryAlias: SymbolAlias | null;
  matchedAlias: SymbolAlias | null;
  aliases?: SymbolAlias[];
}

export interface ResolveSymbolOptions {
  source?: string;
  type?: string;
  includeAliases?: boolean;
}

export interface ProviderAliasOptions {
  type?: string;
  includeInactive?: boolean;
}

interface ResolvedSymbolInputMetadata {
  canonicalId: string;
  providerAlias: string | null;
  displayTicker: string | null;
  currency: string;
  quoteToCurrencyRate: number;
}

interface ResolvedSymbolCanonicalMetadata {
  providerAlias: string | null;
  displayTicker: string | null;
  currency: string;
  quoteToCurrencyRate: number;
}

interface SymbolResolutionMetadata {
  ticker: string;
  currency: string;
  quoteToCurrencyRate: number;
}

/**
 * Resolve a user or provider supplied identifier to the canonical symbol UUID.
 * Accepts UUIDs directly; otherwise looks up an alias of the requested type/source.
 */
export async function resolveSymbolInput(
  input: string,
  options: ResolveSymbolOptions = {},
): Promise<CanonicalSymbol | null> {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  const type = options.type ?? DEFAULT_ALIAS_TYPE;
  const normalized = normalizeSymbolAliasValue(trimmed);
  const supabase = await createServiceClient();

  if (UUID_PATTERN.test(normalized)) {
    return getCanonicalSymbol(normalized, {
      includeAliases: options.includeAliases,
    });
  }

  let query = supabase
    .from("symbol_aliases")
    .select("*, symbol:symbols (*)")
    .order("is_primary", { ascending: false })
    .order("effective_to", { ascending: true, nullsFirst: true })
    .limit(1);

  if (type) {
    query = query.eq("type", type);
  }

  if (options.source) {
    query = query.eq("source", options.source);
  }

  const { data: aliasRows, error } = await query.ilike("value", normalized);

  if (error) {
    throw new Error(
      `Failed to resolve symbol alias "${normalized}": ${error.message}`,
    );
  }

  const aliasWithSymbol = aliasRows?.[0] as
    (SymbolAlias & { symbol: Symbol }) | undefined;
  if (!aliasWithSymbol) return null;

  const { symbol, ...alias } = aliasWithSymbol;
  const matchedAlias = alias as SymbolAlias;

  const primaryAlias = matchedAlias.is_primary
    ? matchedAlias
    : await loadPrimarySymbolAlias(supabase, symbol.id);

  const aliases = options.includeAliases
    ? await loadSymbolAliases(supabase, symbol.id)
    : undefined;

  return {
    symbol,
    primaryAlias,
    matchedAlias,
    aliases,
  };
}

/**
 * Fetch the canonical symbol by UUID, optionally including alias metadata.
 */
export async function getCanonicalSymbol(
  symbolId: string,
  options: { includeAliases?: boolean } = {},
): Promise<CanonicalSymbol | null> {
  const trimmed = symbolId?.trim();
  if (!trimmed) return null;

  const supabase = await createServiceClient();

  const { data: symbol, error } = await supabase
    .from("symbols")
    .select("*")
    .eq("id", trimmed)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch canonical symbol "${trimmed}": ${error.message}`,
    );
  }

  if (!symbol) return null;

  const primaryAlias = await loadPrimarySymbolAlias(supabase, symbol.id);
  const aliases = options.includeAliases
    ? await loadSymbolAliases(supabase, symbol.id)
    : undefined;

  return {
    symbol,
    primaryAlias,
    matchedAlias: null,
    aliases,
  };
}

/**
 * Retrieve the alias used by a specific provider (e.g. Yahoo Finance).
 */
export async function getProviderSymbolAlias(
  symbolId: string,
  source: string = DEFAULT_ALIAS_SOURCE,
  options: ProviderAliasOptions = {},
): Promise<SymbolAlias | null> {
  const supabase = await createServiceClient();

  let query = supabase
    .from("symbol_aliases")
    .select("*")
    .eq("symbol_id", symbolId)
    .eq("source", source)
    .order("effective_from", { ascending: false })
    .limit(1);

  if (options.type) {
    query = query.eq("type", options.type);
  }

  if (!options.includeInactive) {
    query = query.is("effective_to", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Failed to fetch provider alias for symbol "${symbolId}": ${error.message}`,
    );
  }

  return data?.[0] ?? null;
}

/**
 * Promote or create a primary alias and sync the symbol's ticker.
 * Ensures only one alias per symbol is marked primary at a time.
 */
export async function setPrimarySymbolAlias(
  symbolId: string,
  aliasValue: string,
  options: { source?: string; type?: string } = {},
): Promise<SymbolAlias> {
  const supabase = await createServiceClient();
  const type = options.type ?? DEFAULT_ALIAS_TYPE;
  const source = options.source ?? DEFAULT_ALIAS_SOURCE;
  const normalizedValue = normalizeSymbolAliasValue(aliasValue);
  const nowIso = new Date().toISOString();

  const { error: demoteError } = await supabase
    .from("symbol_aliases")
    .update({ is_primary: false, updated_at: nowIso })
    .eq("symbol_id", symbolId);

  if (demoteError) {
    throw new Error(
      `Failed to demote existing aliases for symbol "${symbolId}": ${demoteError.message}`,
    );
  }

  const { data: existingAlias, error: fetchError } = await supabase
    .from("symbol_aliases")
    .select("*")
    .eq("symbol_id", symbolId)
    .eq("type", type)
    .eq("value", normalizedValue)
    .maybeSingle();

  if (fetchError) {
    throw new Error(
      `Failed to check existing aliases for symbol "${symbolId}": ${fetchError.message}`,
    );
  }

  if (existingAlias) {
    const { data, error } = await supabase
      .from("symbol_aliases")
      .update({
        is_primary: true,
        source,
        effective_to: null,
        updated_at: nowIso,
      })
      .eq("id", existingAlias.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to promote existing alias "${normalizedValue}" for symbol "${symbolId}": ${error?.message}`,
      );
    }

    return data;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("symbol_aliases")
    .insert({
      symbol_id: symbolId,
      value: normalizedValue,
      type,
      source,
      is_primary: true,
      effective_from: nowIso,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Failed to insert primary alias "${normalizedValue}" for symbol "${symbolId}": ${insertError?.message}`,
    );
  }

  return inserted;
}

/**
 * Create or refresh a non-primary alias without changing the symbol's display
 * ticker. Broker imports use this for identifiers such as ISINs.
 */
export async function upsertSymbolAlias(
  symbolId: string,
  aliasValue: string,
  options: { source?: string; type?: string } = {},
): Promise<SymbolAlias> {
  const supabase = await createServiceClient();
  const type = options.type ?? DEFAULT_ALIAS_TYPE;
  const source = options.source ?? DEFAULT_ALIAS_SOURCE;
  const normalizedValue = normalizeSymbolAliasValue(aliasValue);
  const nowIso = new Date().toISOString();

  const { data: existingAliases, error: fetchError } = await supabase
    .from("symbol_aliases")
    .select("*")
    .eq("symbol_id", symbolId)
    .eq("type", type)
    .eq("value", normalizedValue)
    .is("effective_to", null)
    .limit(1);

  if (fetchError) {
    throw new Error(
      `Failed to check existing alias "${normalizedValue}" for symbol "${symbolId}": ${fetchError.message}`,
    );
  }

  const existingAlias = existingAliases?.[0];
  if (existingAlias) {
    const { data, error } = await supabase
      .from("symbol_aliases")
      .update({
        is_primary: false,
        effective_to: null,
        updated_at: nowIso,
      })
      .eq("id", existingAlias.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to refresh alias "${normalizedValue}" for symbol "${symbolId}": ${error?.message}`,
      );
    }

    return data;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("symbol_aliases")
    .insert({
      symbol_id: symbolId,
      value: normalizedValue,
      type,
      source,
      is_primary: false,
      effective_from: nowIso,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Failed to insert alias "${normalizedValue}" for symbol "${symbolId}": ${insertError?.message}`,
    );
  }

  return inserted;
}

async function loadPrimarySymbolAlias(
  supabase: SupabaseClient<Database>,
  symbolId: string,
): Promise<SymbolAlias | null> {
  const { data, error } = await supabase
    .from("symbol_aliases")
    .select("*")
    .eq("symbol_id", symbolId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch primary alias for symbol "${symbolId}": ${error.message}`,
    );
  }

  return data ?? null;
}

async function loadSymbolAliases(
  supabase: SupabaseClient<Database>,
  symbolId: string,
): Promise<SymbolAlias[]> {
  const { data, error } = await supabase
    .from("symbol_aliases")
    .select("*")
    .eq("symbol_id", symbolId)
    .order("is_primary", { ascending: false })
    .order("effective_from", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to list aliases for symbol "${symbolId}": ${error.message}`,
    );
  }

  return data ?? [];
}

/**
 * Batch resolve multiple symbol identifiers to canonical UUIDs and provider aliases.
 * Useful for market data fetching (quotes, dividends, news) where you need both
 * the canonical ID for database operations and the provider ticker for API calls.
 *
 * @param symbolInputs - Array of symbol identifiers (tickers, UUIDs, aliases)
 * @param options - Resolution options
 * @returns Maps for efficient lookup: input -> resolution, canonicalId -> provider metadata
 */
export async function resolveSymbolsBatch(
  symbolInputs: string[],
  options: {
    provider?: string;
    providerType?: string;
    providerAliasMode?: ProviderAliasMode;
    onError?: "throw" | "warn" | "skip";
  } = {},
): Promise<{
  byInput: Map<string, ResolvedSymbolInputMetadata>;
  byCanonicalId: Map<string, ResolvedSymbolCanonicalMetadata>;
}> {
  const provider = options.provider ?? DEFAULT_ALIAS_SOURCE;
  const providerType = options.providerType ?? DEFAULT_ALIAS_TYPE;
  const providerAliasMode = options.providerAliasMode ?? "display-fallback";
  const onError = options.onError ?? "throw";

  const byInput = new Map<string, ResolvedSymbolInputMetadata>();
  const byCanonicalId = new Map<string, ResolvedSymbolCanonicalMetadata>();

  // Deduplicate and normalize inputs once.
  const uniqueInputs = [
    ...new Set(
      symbolInputs.map((id) => id.trim()).filter((id) => id.length > 0),
    ),
  ];

  if (!uniqueInputs.length) {
    return { byInput, byCanonicalId };
  }

  const supabase = await createServiceClient();

  const inputMeta = await Promise.all(
    uniqueInputs.map(async (inputKey) => {
      const isUuid = UUID_PATTERN.test(inputKey);
      const normalized = isUuid
        ? inputKey.toLowerCase()
        : normalizeSymbolAliasValue(inputKey);
      return {
        inputKey,
        normalized,
        isUuid,
      };
    }),
  );

  let canonicalByInput = new Map<string, string>();
  let metadataBySymbolId = new Map<string, SymbolResolutionMetadata>();
  let primaryAliasBySymbolId = new Map<string, string>();
  let providerAliasBySymbolId = new Map<string, string>();

  try {
    const aliasInputs = inputMeta.filter((entry) => !entry.isUuid);
    const aliasLookups = [
      ...new Set(aliasInputs.map((entry) => entry.normalized)),
    ];
    // Fast path: resolve normalized aliases with exact IN matching for batch efficiency.
    // Compatibility path below only runs for misses to keep historical ILIKE behavior for
    // legacy mixed-case rows. If both exact and mixed-case rows exist for the same logical
    // alias, exact match wins by design; keep alias data normalized to avoid ambiguity.
    const canonicalByAliasLookup = await fetchCanonicalIdsByAliasLookups(
      supabase,
      aliasLookups,
    );
    const unresolvedAliasLookups = aliasLookups.filter(
      (aliasLookup) => !canonicalByAliasLookup.has(aliasLookup),
    );
    if (unresolvedAliasLookups.length > 0) {
      // Compatibility fallback: preserve historical case-insensitive alias
      // behavior for any legacy/manual mixed-case rows not matched by exact IN.
      const caseInsensitiveMatches =
        await fetchCanonicalIdsByAliasLookupsCaseInsensitive(
          supabase,
          unresolvedAliasLookups,
        );
      caseInsensitiveMatches.forEach((canonicalId, aliasLookup) => {
        if (!canonicalByAliasLookup.has(aliasLookup)) {
          canonicalByAliasLookup.set(aliasLookup, canonicalId);
        }
      });
    }

    canonicalByInput = new Map<string, string>();
    inputMeta.forEach((entry) => {
      if (entry.isUuid) {
        canonicalByInput.set(entry.inputKey, entry.normalized);
        return;
      }

      const canonicalId = canonicalByAliasLookup.get(entry.normalized);
      if (canonicalId) {
        canonicalByInput.set(entry.inputKey, canonicalId);
      }
    });

    const canonicalIds = [...new Set(canonicalByInput.values())];
    metadataBySymbolId = await fetchSymbolMetadataById(supabase, canonicalIds);
    primaryAliasBySymbolId = await fetchPrimaryAliasesBySymbolId(
      supabase,
      canonicalIds,
    );
    providerAliasBySymbolId = await fetchProviderAliasesBySymbolId(
      supabase,
      canonicalIds,
      provider,
      providerType,
    );
  } catch (error) {
    if (onError === "throw") {
      throw error;
    }

    if (onError === "warn") {
      uniqueInputs.forEach((inputKey) => {
        console.warn(
          `Error resolving symbol "${inputKey}":`,
          error instanceof Error ? error.message : error,
        );
      });
    }

    return { byInput, byCanonicalId };
  }

  for (const inputKey of uniqueInputs) {
    try {
      // 1) Resolve input to canonical symbol ID.
      const canonicalId = canonicalByInput.get(inputKey);
      const symbolMetadata = canonicalId
        ? metadataBySymbolId.get(canonicalId)
        : undefined;
      if (!canonicalId || !symbolMetadata) {
        const errorMsg = `Unable to resolve symbol identifier "${inputKey}" to a canonical symbol.`;
        if (onError === "throw") {
          throw new Error(errorMsg);
        }
        if (onError === "warn") {
          console.warn(errorMsg);
        }
        continue;
      }

      // 2) Resolve an active provider alias for live callers. Display callers
      // retain the historical primary/canonical ticker fallback.
      const activeProviderAlias =
        providerAliasBySymbolId.get(canonicalId) ?? null;
      const providerAlias =
        providerAliasMode === "active-only"
          ? activeProviderAlias
          : (activeProviderAlias ??
            primaryAliasBySymbolId.get(canonicalId) ??
            symbolMetadata.ticker);

      if (providerAliasMode === "display-fallback" && !providerAlias) {
        const errorMsg = `Symbol "${inputKey}" is missing a ${provider} ${providerType} alias.`;
        if (onError === "throw") {
          throw new Error(errorMsg);
        }
        if (onError === "warn") {
          console.warn(errorMsg);
        }
        continue;
      }

      // 3) Resolve display ticker and store maps.
      const displayTicker =
        primaryAliasBySymbolId.get(canonicalId) ??
        symbolMetadata.ticker ??
        null;

      byInput.set(inputKey, {
        canonicalId,
        providerAlias,
        displayTicker,
        currency: symbolMetadata.currency,
        quoteToCurrencyRate: symbolMetadata.quoteToCurrencyRate,
      });

      if (!byCanonicalId.has(canonicalId)) {
        byCanonicalId.set(canonicalId, {
          providerAlias,
          displayTicker,
          currency: symbolMetadata.currency,
          quoteToCurrencyRate: symbolMetadata.quoteToCurrencyRate,
        });
      }
    } catch (error) {
      if (onError === "throw") {
        throw error;
      }
      if (onError === "warn") {
        console.warn(
          `Error resolving symbol "${inputKey}":`,
          error instanceof Error ? error.message : error,
        );
      }
      // onError === "skip" silently continues
    }
  }

  return { byInput, byCanonicalId };
}

async function fetchCanonicalIdsByAliasLookups(
  supabase: SupabaseClient<Database>,
  aliasLookups: string[],
) {
  const canonicalByAliasLookup = new Map<string, string>();
  if (!aliasLookups.length) return canonicalByAliasLookup;

  for (const aliasChunk of chunkArray(aliasLookups, BATCH_QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("symbol_aliases")
      .select("value, symbol_id, is_primary, effective_to")
      .eq("type", DEFAULT_ALIAS_TYPE)
      .in("value", aliasChunk)
      .order("value", { ascending: true })
      .order("is_primary", { ascending: false })
      .order("effective_to", { ascending: true, nullsFirst: true });

    if (error) {
      throw new Error(
        `Failed to batch resolve symbol aliases: ${error.message}`,
      );
    }

    data?.forEach((row) => {
      if (!canonicalByAliasLookup.has(row.value)) {
        canonicalByAliasLookup.set(row.value, row.symbol_id);
      }
    });
  }

  return canonicalByAliasLookup;
}

async function fetchCanonicalIdsByAliasLookupsCaseInsensitive(
  supabase: SupabaseClient<Database>,
  aliasLookups: string[],
) {
  const canonicalByAliasLookup = new Map<string, string>();
  if (!aliasLookups.length) return canonicalByAliasLookup;

  for (const aliasLookup of aliasLookups) {
    const { data, error } = await supabase
      .from("symbol_aliases")
      .select("value, symbol_id, is_primary, effective_to")
      .eq("type", DEFAULT_ALIAS_TYPE)
      .order("is_primary", { ascending: false })
      .order("effective_to", { ascending: true, nullsFirst: true })
      .limit(1)
      .ilike("value", aliasLookup);

    if (error) {
      throw new Error(
        `Failed to case-insensitive resolve symbol alias "${aliasLookup}": ${error.message}`,
      );
    }

    if (data?.[0]) {
      canonicalByAliasLookup.set(aliasLookup, data[0].symbol_id);
    }
  }

  return canonicalByAliasLookup;
}

async function fetchSymbolMetadataById(
  supabase: SupabaseClient<Database>,
  symbolIds: string[],
) {
  const metadataBySymbolId = new Map<string, SymbolResolutionMetadata>();
  if (!symbolIds.length) return metadataBySymbolId;

  for (const symbolIdChunk of chunkArray(symbolIds, BATCH_QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("symbols")
      .select("id, ticker, currency, quote_to_currency_rate")
      .in("id", symbolIdChunk);

    if (error) {
      throw new Error(`Failed to batch fetch symbols: ${error.message}`);
    }

    data?.forEach((symbolRow) => {
      metadataBySymbolId.set(symbolRow.id, {
        ticker: symbolRow.ticker,
        currency: symbolRow.currency,
        quoteToCurrencyRate: normalizeQuoteToCurrencyRate(
          symbolRow.quote_to_currency_rate,
        ),
      });
    });
  }

  return metadataBySymbolId;
}

async function fetchPrimaryAliasesBySymbolId(
  supabase: SupabaseClient<Database>,
  symbolIds: string[],
) {
  const primaryAliasBySymbolId = new Map<string, string>();
  if (!symbolIds.length) return primaryAliasBySymbolId;

  for (const symbolIdChunk of chunkArray(symbolIds, BATCH_QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("symbol_aliases")
      .select("symbol_id, value")
      .eq("is_primary", true)
      .in("symbol_id", symbolIdChunk);

    if (error) {
      throw new Error(
        `Failed to batch fetch primary aliases: ${error.message}`,
      );
    }

    data?.forEach((aliasRow) => {
      if (!primaryAliasBySymbolId.has(aliasRow.symbol_id)) {
        primaryAliasBySymbolId.set(aliasRow.symbol_id, aliasRow.value);
      }
    });
  }

  return primaryAliasBySymbolId;
}

async function fetchProviderAliasesBySymbolId(
  supabase: SupabaseClient<Database>,
  symbolIds: string[],
  provider: string,
  providerType: string,
) {
  const providerAliasBySymbolId = new Map<string, string>();
  if (!symbolIds.length) return providerAliasBySymbolId;

  for (const symbolIdChunk of chunkArray(symbolIds, BATCH_QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("symbol_aliases")
      .select("symbol_id, value, effective_from")
      .eq("source", provider)
      .eq("type", providerType)
      .is("effective_to", null)
      .in("symbol_id", symbolIdChunk)
      .order("symbol_id", { ascending: true })
      .order("effective_from", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to batch fetch provider aliases: ${error.message}`,
      );
    }

    data?.forEach((aliasRow) => {
      if (!providerAliasBySymbolId.has(aliasRow.symbol_id)) {
        providerAliasBySymbolId.set(aliasRow.symbol_id, aliasRow.value);
      }
    });
  }

  return providerAliasBySymbolId;
}

// Both alias types normalize identically: symbols and provider aliases are
// stored uppercase and trimmed.
function normalizeSymbolAliasValue(value: string) {
  return value.trim().toUpperCase();
}
