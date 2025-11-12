"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeSymbol } from "@/server/symbols/validate";
import { createServiceClient } from "@/supabase/service";

import type { Database } from "@/types/database.types";
import type { Symbol, SymbolAlias } from "@/types/global.types";

const DEFAULT_ALIAS_TYPE = "ticker";
const DEFAULT_ALIAS_SOURCE = "yahoo";

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

async function normalizeSymbolAliasValue(value: string, type?: string) {
  if ((type ?? DEFAULT_ALIAS_TYPE) === DEFAULT_ALIAS_TYPE) {
    return await normalizeSymbol(value);
  }

  return value.trim().toUpperCase();
}
