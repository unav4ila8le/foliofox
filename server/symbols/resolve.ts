"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeSymbol } from "@/server/symbols/validate";
import { createServiceClient } from "@/supabase/service";

import type { Database } from "@/types/database.types";
import type { Symbol, SymbolAlias } from "@/types/global.types";

const DEFAULT_ALIAS_TYPE = "ticker";
const DEFAULT_ALIAS_SOURCE = "yahoo";
const BATCH_QUERY_CHUNK_SIZE = 200;

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
  const normalized = await normalizeSymbolAliasValue(trimmed, type);
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
    | (SymbolAlias & { symbol: Symbol })
    | undefined;
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
  const normalizedValue = await normalizeSymbolAliasValue(aliasValue, type);
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
    onError?: "throw" | "warn" | "skip";
  } = {},
): Promise<{
  byInput: Map<
    string,
    {
      canonicalId: string;
      providerAlias: string;
      displayTicker: string | null;
    }
  >;
  byCanonicalId: Map<
    string,
    {
      providerAlias: string;
      displayTicker: string | null;
    }
  >;
}> {
  const provider = options.provider ?? DEFAULT_ALIAS_SOURCE;
  const providerType = options.providerType ?? DEFAULT_ALIAS_TYPE;
  const onError = options.onError ?? "throw";

  const byInput = new Map<
    string,
    {
      canonicalId: string;
      providerAlias: string;
      displayTicker: string | null;
    }
  >();
  const byCanonicalId = new Map<
    string,
    {
      providerAlias: string;
      displayTicker: string | null;
    }
  >();

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
        : await normalizeSymbolAliasValue(inputKey, DEFAULT_ALIAS_TYPE);
      return {
        inputKey,
        normalized,
        isUuid,
      };
    }),
  );

  let canonicalByInput = new Map<string, string>();
  let tickerBySymbolId = new Map<string, string>();
  let primaryAliasBySymbolId = new Map<string, string>();
  let providerAliasBySymbolId = new Map<string, string>();

  try {
    const aliasInputs = inputMeta.filter((entry) => !entry.isUuid);
    const aliasLookups = [
      ...new Set(aliasInputs.map((entry) => entry.normalized)),
    ];
    const canonicalByAliasLookup = await fetchCanonicalIdsByAliasLookups(
      supabase,
      aliasLookups,
    );

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
    tickerBySymbolId = await fetchSymbolTickersById(supabase, canonicalIds);
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
      if (!canonicalId || !tickerBySymbolId.has(canonicalId)) {
        const errorMsg = `Unable to resolve symbol identifier "${inputKey}" to a canonical symbol.`;
        if (onError === "throw") {
          throw new Error(errorMsg);
        }
        if (onError === "warn") {
          console.warn(errorMsg);
        }
        continue;
      }

      // 2) Resolve provider alias with fallback order.
      const providerAlias =
        providerAliasBySymbolId.get(canonicalId) ??
        primaryAliasBySymbolId.get(canonicalId) ??
        tickerBySymbolId.get(canonicalId);

      if (!providerAlias) {
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
        tickerBySymbolId.get(canonicalId) ??
        null;

      byInput.set(inputKey, {
        canonicalId,
        providerAlias,
        displayTicker,
      });

      if (!byCanonicalId.has(canonicalId)) {
        byCanonicalId.set(canonicalId, {
          providerAlias,
          displayTicker,
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

  for (const aliasChunk of chunkValues(aliasLookups, BATCH_QUERY_CHUNK_SIZE)) {
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

async function fetchSymbolTickersById(
  supabase: SupabaseClient<Database>,
  symbolIds: string[],
) {
  const tickerBySymbolId = new Map<string, string>();
  if (!symbolIds.length) return tickerBySymbolId;

  for (const symbolIdChunk of chunkValues(symbolIds, BATCH_QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("symbols")
      .select("id, ticker")
      .in("id", symbolIdChunk);

    if (error) {
      throw new Error(`Failed to batch fetch symbols: ${error.message}`);
    }

    data?.forEach((symbolRow) => {
      tickerBySymbolId.set(symbolRow.id, symbolRow.ticker);
    });
  }

  return tickerBySymbolId;
}

async function fetchPrimaryAliasesBySymbolId(
  supabase: SupabaseClient<Database>,
  symbolIds: string[],
) {
  const primaryAliasBySymbolId = new Map<string, string>();
  if (!symbolIds.length) return primaryAliasBySymbolId;

  for (const symbolIdChunk of chunkValues(symbolIds, BATCH_QUERY_CHUNK_SIZE)) {
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

  for (const symbolIdChunk of chunkValues(symbolIds, BATCH_QUERY_CHUNK_SIZE)) {
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

async function normalizeSymbolAliasValue(value: string, type?: string) {
  if ((type ?? DEFAULT_ALIAS_TYPE) === DEFAULT_ALIAS_TYPE) {
    return await normalizeSymbol(value);
  }

  return value.trim().toUpperCase();
}

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  if (values.length === 0) return [];
  if (chunkSize <= 0) return [values];

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}
