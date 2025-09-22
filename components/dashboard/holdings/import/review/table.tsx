"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

import { useAssetCategories } from "@/hooks/use-asset-categories";
import { ReviewForm } from "./form";

import type { HoldingRow } from "@/types/global.types";
import type { CurrencyValidationResult } from "@/server/currencies/validate";
import type { SymbolValidationResult } from "@/server/symbols/validate";
import type { ImportActionResult } from "@/lib/import/types";

interface HoldingsImportReviewTableProps {
  initialHoldings: HoldingRow[];
  onCancel: () => void;
  onImport: (holdings: HoldingRow[]) => Promise<ImportActionResult>;
  onSuccess: () => void;
  // Optional server-computed validations to avoid re-validating on mount
  precomputedSymbolValidation?: Record<string, SymbolValidationResult>;
  supportedCurrencies?: string[];
}

// Table component wrapper
export function HoldingsImportReviewTable({
  initialHoldings,
  onCancel,
  onImport,
  onSuccess,
  precomputedSymbolValidation,
  supportedCurrencies,
}: HoldingsImportReviewTableProps) {
  const { categories, isLoading: isLoadingCategories } = useAssetCategories();

  // Build validation maps from precomputed props (no network calls)
  const usedSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          initialHoldings
            .map((h) => h.symbol_id)
            .filter((s): s is string => Boolean(s)),
        ),
      ),
    [initialHoldings],
  );

  const symbolValidation = useMemo<
    Record<string, SymbolValidationResult>
  >(() => {
    const map: Record<string, SymbolValidationResult> = {};
    usedSymbols.forEach((s) => {
      const v = precomputedSymbolValidation?.[s];
      map[s] = v
        ? { valid: v.valid, error: v.error }
        : { valid: false, error: "Invalid symbol" };
    });
    return map;
  }, [usedSymbols, precomputedSymbolValidation]);

  const usedCurrencies = useMemo(
    () =>
      Array.from(
        new Set(
          initialHoldings
            .map((h) => h.currency)
            .filter((c): c is string => Boolean(c)),
        ),
      ),
    [initialHoldings],
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
      initialHoldings={initialHoldings}
      onCancel={onCancel}
      onImport={onImport}
      onSuccess={onSuccess}
      categories={categories}
      currencyValidation={currencyValidation}
      symbolValidation={symbolValidation}
    />
  );
}
