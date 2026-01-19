"use server";

import {
  resolveSymbolInput,
  type CanonicalSymbol,
  type ResolveSymbolOptions,
} from "@/server/symbols/resolve";
import { createSymbol } from "@/server/symbols/create";
import { validateSymbol } from "@/server/symbols/validate";

/**
 * Resolve a symbol, creating it if it doesn't exist in the local database.
 *
 * Guards against silent listing switches by refusing to auto-create when:
 * - Input contains ":" (exchange-qualified, e.g., "LSE:VOD")
 * - Normalization changes the input beyond casing (e.g., stripping prefixes)
 *
 * For ambiguous inputs (company names, exchange-qualified symbols), callers
 * should use searchSymbols first to get the exact ticker.
 */
export async function ensureSymbol(
  input: string,
  options: ResolveSymbolOptions = {},
): Promise<CanonicalSymbol | null> {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  // Guard: Don't auto-create exchange-qualified inputs (e.g., "LSE:VOD")
  // These require explicit searchSymbols to confirm the correct listing
  if (trimmedInput.includes(":")) {
    return null;
  }

  const resolvedSymbol = await resolveSymbolInput(trimmedInput, options);
  if (resolvedSymbol?.symbol?.id) {
    return resolvedSymbol;
  }

  const validationResult = await validateSymbol(trimmedInput);

  // Only proceed if validation passed directly - don't auto-pick suggestions
  if (!validationResult.valid || !validationResult.normalized) {
    return null;
  }

  // Guard: Don't auto-create if normalization changed the input beyond casing
  // This prevents silent listing switches (e.g., "NYSE:IBM" → "IBM")
  if (validationResult.normalized !== trimmedInput.toUpperCase()) {
    return null;
  }

  const candidateSymbol = validationResult.normalized;

  const resolvedCandidate = await resolveSymbolInput(candidateSymbol, options);
  if (resolvedCandidate?.symbol?.id) {
    return resolvedCandidate;
  }

  const createdSymbol = await createSymbol(candidateSymbol);
  if (!createdSymbol.success) {
    return null;
  }

  return resolveSymbolInput(candidateSymbol, options);
}
