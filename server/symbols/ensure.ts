"use server";

import {
  resolveSymbolInput,
  type CanonicalSymbol,
  type ResolveSymbolOptions,
} from "@/server/symbols/resolver";
import { normalizeSymbol } from "@/server/symbols/validate";
import { createSymbol } from "@/server/symbols/create";

export async function ensureSymbol(
  input: string,
  options: ResolveSymbolOptions = {},
): Promise<CanonicalSymbol | null> {
  const resolved = await resolveSymbolInput(input, options);
  if (resolved?.symbol?.id) return resolved;

  const normalized = await normalizeSymbol(input);
  if (!normalized) return null;

  const created = await createSymbol(normalized);
  if (!created.success) return null;

  return resolveSymbolInput(normalized, options);
}
