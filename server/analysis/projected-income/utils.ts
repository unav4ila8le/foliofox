import { parseUtcDateKey } from "@/lib/date/date-utils";

import type {
  Dividend,
  DividendEvent,
  TransformedPosition,
} from "@/types/global.types";

export interface DividendProjectionBasis {
  annualAmount: number;
  frequency: Dividend["inferred_frequency"] | null;
  lastPaymentMonth: number | null;
  currency: string;
}

export function buildProjectionBasisBySymbolId(
  positions: TransformedPosition[],
  dividendsMap: Map<string, { summary: Dividend; events: DividendEvent[] }>,
): Map<string, DividendProjectionBasis> {
  const projectionBasisBySymbolId = new Map<string, DividendProjectionBasis>();

  positions.forEach((position) => {
    if (!position.symbol_id) return;
    if (projectionBasisBySymbolId.has(position.symbol_id)) return;

    const dividendData = dividendsMap.get(position.symbol_id);
    if (!dividendData?.summary) return;
    if (
      dividendData.summary.pays_dividends === false &&
      dividendData.events.length === 0
    ) {
      return;
    }

    const basis = buildDividendProjectionBasis(
      dividendData.summary,
      dividendData.events,
      {
        currentUnitValue: position.current_unit_value,
        fallbackCurrency: position.currency,
      },
    );

    if (basis) {
      projectionBasisBySymbolId.set(position.symbol_id, basis);
    }
  });

  return projectionBasisBySymbolId;
}

export function calculateMonthlyDividend(
  month: Date,
  basis: DividendProjectionBasis,
): number {
  if (!basis.annualAmount || basis.annualAmount <= 0) {
    return 0;
  }

  const frequency = basis.frequency;
  const lastPaymentMonth = basis.lastPaymentMonth;
  const currentMonth = month.getMonth();

  switch (frequency) {
    case "monthly":
      return basis.annualAmount / 12;
    case "quarterly":
      if (lastPaymentMonth === null) {
        return basis.annualAmount / 12;
      }
      // Check if this month aligns with quarterly pattern
      const monthsSinceLastPayment =
        (currentMonth - lastPaymentMonth + 12) % 12;
      return monthsSinceLastPayment % 3 === 0 ? basis.annualAmount / 4 : 0;
    case "semiannual":
      if (lastPaymentMonth === null) {
        return basis.annualAmount / 12;
      }
      // Check if this month aligns with semiannual pattern (every 6 months)
      const monthsSinceLastPaymentSemi =
        (currentMonth - lastPaymentMonth + 12) % 12;
      return monthsSinceLastPaymentSemi % 6 === 0 ? basis.annualAmount / 2 : 0;
    case "annual":
      if (lastPaymentMonth === null) {
        return basis.annualAmount / 12;
      }
      // Return full annual amount only in the payment month
      return currentMonth === lastPaymentMonth ? basis.annualAmount : 0;
    case "irregular":
      return basis.annualAmount / 12;
    default:
      return basis.annualAmount / 12;
  }
}

export function buildDividendProjectionBasis(
  summary: Dividend,
  events: DividendEvent[],
  options: {
    currentUnitValue?: number;
    fallbackCurrency: string;
  },
): DividendProjectionBasis | null {
  const annualAmount = resolveAnnualDividendAmount(
    summary,
    events,
    options.currentUnitValue,
  );

  if (!annualAmount || annualAmount <= 0) {
    return null;
  }

  const latestEvent = getLatestDividendEvent(events);
  const lastPaymentMonth = resolveLastPaymentMonth(summary, latestEvent);

  return {
    annualAmount,
    frequency: summary.inferred_frequency ?? "irregular",
    lastPaymentMonth,
    currency: latestEvent?.currency ?? options.fallbackCurrency,
  };
}

function resolveAnnualDividendAmount(
  summary: Dividend,
  events: DividendEvent[],
  currentUnitValue?: number,
): number {
  // Prefer provider amounts unless they are clearly inflated compared to payouts we observed.
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const recentEvents = events.filter(
    (event) => new Date(event.event_date) >= oneYearAgo,
  );

  const eventAnnualAmount =
    recentEvents.length > 0
      ? recentEvents.reduce((sum, event) => sum + event.gross_amount, 0)
      : 0;

  const providerTtm = summary.trailing_ttm_dividend || 0;
  const providerForward = summary.forward_annual_dividend || 0;

  const hasEvents = eventAnnualAmount > 0;
  const ttmWithinTolerance =
    providerTtm > 0 && hasEvents
      ? providerTtm >= eventAnnualAmount * 0.9 &&
        providerTtm <= eventAnnualAmount * 1.1
      : true;

  // Keep TTM when it aligns with payouts (±10%); otherwise prefer events, then forward.
  let annualAmount =
    providerTtm > 0 && ttmWithinTolerance
      ? providerTtm
      : hasEvents
        ? eventAnnualAmount
        : providerForward > 0
          ? providerForward
          : providerTtm;

  if (annualAmount <= 0) {
    // Yahoo dividend_yield is an annual rate (decimal, e.g. 0.04 = 4%).
    const yieldRate = summary.dividend_yield ?? 0;
    if (yieldRate > 0 && currentUnitValue && currentUnitValue > 0) {
      annualAmount = yieldRate * currentUnitValue;
    }
  }

  return annualAmount > 0 ? annualAmount : 0;
}

function resolveLastPaymentMonth(
  summary: Dividend,
  latestEvent: DividendEvent | null,
): number | null {
  const lastDividendDate =
    summary.last_dividend_date ?? latestEvent?.event_date ?? null;

  if (!lastDividendDate) return null;

  const parsed = parseUtcDateKey(lastDividendDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.getUTCMonth();
}

function getLatestDividendEvent(events: DividendEvent[]): DividendEvent | null {
  if (events.length === 0) return null;

  return events.reduce(
    (latest, current) => {
      if (!latest) return current;
      return new Date(current.event_date) > new Date(latest.event_date)
        ? current
        : latest;
    },
    null as DividendEvent | null,
  );
}
