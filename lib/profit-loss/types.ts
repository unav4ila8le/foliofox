export interface ProfitLossAmountSummary {
  amount: number;
}

export interface ProfitLossAmountWithPercentageSummary extends ProfitLossAmountSummary {
  percentage: number;
}

export interface PositionCostBasisSummary {
  perUnit: number;
  total: number;
}

export interface PositionUnrealizedProfitLossSummary {
  costBasis: PositionCostBasisSummary;
  unrealized: ProfitLossAmountWithPercentageSummary;
}

export interface PositionRealizedProfitLossSummary {
  realized: ProfitLossAmountSummary;
}

export interface PositionProfitLossSummary
  extends
    PositionUnrealizedProfitLossSummary,
    PositionRealizedProfitLossSummary {}
