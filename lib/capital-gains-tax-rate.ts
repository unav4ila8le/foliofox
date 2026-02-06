import { z } from "zod";

export const capitalGainsTaxRatePercentSchema = z
  .string()
  .optional()
  .refine(
    (value) =>
      value === undefined ||
      value.trim() === "" ||
      Number.isFinite(Number(value)),
    {
      error: "Capital gains tax rate must be a number.",
    },
  )
  .refine(
    (value) => {
      if (value === undefined || value.trim() === "") return true;

      const parsedValue = Number(value);
      return parsedValue >= 0 && parsedValue <= 100;
    },
    {
      error: "Capital gains tax rate must be between 0 and 100.",
    },
  );

// Form input uses percentage values, DB stores decimal values.
export function parseCapitalGainsTaxRatePercent(
  value: string | null | undefined,
): number | null {
  if (value == null) return null;

  const trimmedValue = value.trim();
  if (trimmedValue === "") return null;

  const parsedValue = Number(trimmedValue);
  if (!Number.isFinite(parsedValue)) return null;

  return parsedValue / 100;
}

export function formatCapitalGainsTaxRatePercent(
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value * 100);
}

/**
 * Normalize import/edit numeric input to DB decimal format.
 *
 * Accepted input formats:
 * - Decimal rate: 0..1 (stored as-is)
 * - Percentage rate: >1..100 (stored as percentage / 100)
 * - Empty/null: null
 *
 * Invalid values return NaN so callers can surface validation errors.
 */
export function normalizeCapitalGainsTaxRateToDecimal(
  value: number | null | undefined,
): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return Number.NaN;
  if (value < 0 || value > 100) return Number.NaN;

  return value > 1 ? value / 100 : value;
}
