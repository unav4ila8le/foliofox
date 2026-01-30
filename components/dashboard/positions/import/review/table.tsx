"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/custom/skeleton";

import { usePositionCategories } from "@/hooks/use-position-categories";
import { ReviewForm } from "./form";

import type { CurrencyValidationResult } from "@/server/currencies/validate";
import type { SymbolValidationResult } from "@/server/symbols/validate";
import type { PositionImportRow } from "@/lib/import/positions/types";
import type { ImportActionResult } from "@/lib/import/shared/types";

interface PositionsImportReviewTableProps {
  initialPositions: PositionImportRow[];
  onCancel: () => void;
  onImport: (positions: PositionImportRow[]) => Promise<ImportActionResult>;
  onSuccess: () => void;
  // Optional server-computed validations to avoid re-validating on mount
  precomputedSymbolValidation?: Record<string, SymbolValidationResult>;
  supportedCurrencies?: string[];
}

// Table component wrapper
export function PositionsImportReviewTable({
  initialPositions,
  onCancel,
  onImport,
  onSuccess,
  precomputedSymbolValidation,
  supportedCurrencies,
}: PositionsImportReviewTableProps) {
  const { categories, isLoading: isLoadingCategories } =
    usePositionCategories();

  // Build validation maps from precomputed props (no network calls)
  const usedSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          initialPositions
            .map((p) => p.symbolLookup)
            .filter((s): s is string => Boolean(s)),
        ),
      ),
    [initialPositions],
  );

  const symbolValidation = useMemo<
    Record<string, SymbolValidationResult>
  >(() => {
    const map: Record<string, SymbolValidationResult> = {};
    usedSymbols.forEach((s) => {
      const v = precomputedSymbolValidation?.[s];
      map[s] = v ? v : { valid: false, error: "Invalid symbol" };
    });
    return map;
  }, [usedSymbols, precomputedSymbolValidation]);

  const usedCurrencies = useMemo(
    () =>
      Array.from(
        new Set(
          initialPositions
            .map((p) => p.currency)
            .filter((c): c is string => Boolean(c)),
        ),
      ),
    [initialPositions],
  );

  const currencyValidation = useMemo<
    Record<string, CurrencyValidationResult>
  >(() => {
    const map: Record<string, CurrencyValidationResult> = {};
    const supportedSet = new Set(supportedCurrencies ?? []);
    usedCurrencies.forEach((c) => {
      map[c] = supportedSet.has(c)
        ? { valid: true }
        : { valid: false, error: `Currency "${c}" is not supported` };
    });
    return map;
  }, [usedCurrencies, supportedCurrencies]);

  if (isLoadingCategories || categories.length === 0) {
    return <Skeleton count={6} className="h-16" />;
  }

  return (
    <ReviewForm
      initialPositions={initialPositions}
      onCancel={onCancel}
      onImport={onImport}
      onSuccess={onSuccess}
      categories={categories}
      currencyValidation={currencyValidation}
      symbolValidation={symbolValidation}
    />
  );
}
