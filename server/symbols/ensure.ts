"use server";

import {
  resolveSymbolInput,
  type CanonicalSymbol,
  type ResolveSymbolOptions,
} from "@/server/symbols/resolve";
import { createSymbol } from "@/server/symbols/create";
import { validateSymbol } from "@/server/symbols/validate";

export async function ensureSymbol(
  input: string,
  options: ResolveSymbolOptions = {},
): Promise<CanonicalSymbol | null> {
  const resolvedSymbol = await resolveSymbolInput(input, options);
  if (resolvedSymbol?.symbol?.id) {
    return resolvedSymbol;
  }

  const validationResult = await validateSymbol(input);
  const validatedSymbol = validationResult.valid
    ? validationResult.normalized
    : null;

  const suggestedSymbols = validationResult.suggestions ?? [];
  const suggestedSymbol =
    !validatedSymbol && suggestedSymbols.length === 1
      ? suggestedSymbols[0]
      : null;

  const candidateSymbol = validatedSymbol ?? suggestedSymbol;
  if (!candidateSymbol) {
    return null;
  }

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
