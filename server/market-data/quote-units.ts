export interface NormalizedQuoteUnit {
  quoteCurrency: string;
  currency: string;
  quoteToCurrencyRate: number;
}

export type NormalizeQuoteUnitResult =
  | {
      success: true;
      data: NormalizedQuoteUnit;
    }
  | {
      success: false;
      code: "INVALID_QUOTE_UNIT" | "UNSUPPORTED_QUOTE_UNIT";
      message: string;
    };

const QUOTE_UNIT_OVERRIDES: Record<
  string,
  Pick<NormalizedQuoteUnit, "currency" | "quoteToCurrencyRate">
> = {
  // Keep this as a small provider-unit registry. Once it grows beyond a handful
  // of deterministic Yahoo quote units, move the mappings to an admin-managed
  // table while keeping symbols.quote_to_currency_rate as the persisted truth.
  GBp: { currency: "GBP", quoteToCurrencyRate: 0.01 },
  GBX: { currency: "GBP", quoteToCurrencyRate: 0.01 },
  KWF: { currency: "KWD", quoteToCurrencyRate: 0.001 },
  USX: { currency: "USD", quoteToCurrencyRate: 0.01 },
};

const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function normalizeQuoteToCurrencyRate(
  rate: number | null | undefined,
): number {
  // DB rows should always have a positive multiplier, but provider-facing code
  // uses this guard so a malformed fixture or stale row cannot corrupt values.
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0
    ? rate
    : 1;
}

export function normalizeProviderQuoteUnit(
  rawQuoteCurrency: string | null | undefined,
): NormalizeQuoteUnitResult {
  const quoteCurrency = rawQuoteCurrency?.trim();

  if (!quoteCurrency) {
    return {
      success: false,
      code: "INVALID_QUOTE_UNIT",
      message: "Missing provider quote currency.",
    };
  }

  const exactOverride = QUOTE_UNIT_OVERRIDES[quoteCurrency];
  if (exactOverride) {
    return {
      success: true,
      data: {
        quoteCurrency,
        currency: exactOverride.currency,
        quoteToCurrencyRate: exactOverride.quoteToCurrencyRate,
      },
    };
  }

  const normalizedCurrency = quoteCurrency.toUpperCase();
  const uppercaseOverride = QUOTE_UNIT_OVERRIDES[normalizedCurrency];
  if (uppercaseOverride) {
    return {
      success: true,
      data: {
        quoteCurrency,
        currency: uppercaseOverride.currency,
        quoteToCurrencyRate: uppercaseOverride.quoteToCurrencyRate,
      },
    };
  }

  if (ISO_CURRENCY_PATTERN.test(normalizedCurrency)) {
    return {
      success: true,
      data: {
        quoteCurrency,
        currency: normalizedCurrency,
        quoteToCurrencyRate: 1,
      },
    };
  }

  return {
    success: false,
    code: "UNSUPPORTED_QUOTE_UNIT",
    message: `Unsupported provider quote currency "${quoteCurrency}".`,
  };
}
