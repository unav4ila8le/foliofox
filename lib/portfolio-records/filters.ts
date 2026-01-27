import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";

export type PortfolioRecordType = (typeof PORTFOLIO_RECORD_TYPES)[number];

const portfolioRecordTypeSet = new Set(PORTFOLIO_RECORD_TYPES);

export function parsePortfolioRecordTypes(
  value: string | undefined,
): PortfolioRecordType[] {
  if (!value) return [];

  return value
    .split(",")
    .map((type) => type.trim())
    .filter((type): type is PortfolioRecordType =>
      portfolioRecordTypeSet.has(type as PortfolioRecordType),
    );
}

export function normalizePortfolioRecordTypes(
  types: PortfolioRecordType[],
): PortfolioRecordType[] {
  return PORTFOLIO_RECORD_TYPES.filter((type) => types.includes(type));
}
