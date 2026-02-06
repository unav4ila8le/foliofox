interface CalculateCapitalGainsTaxParams {
  positionType: "asset" | "liability";
  capitalGainsTaxRate: number | null;
  unrealizedGain: number;
}

/**
 * Capital gains tax is only applied to positive unrealized gains on assets.
 */
export function calculateCapitalGainsTaxAmount({
  positionType,
  capitalGainsTaxRate,
  unrealizedGain,
}: CalculateCapitalGainsTaxParams): number {
  if (positionType !== "asset") return 0;
  if (capitalGainsTaxRate == null || capitalGainsTaxRate <= 0) return 0;

  const taxableGain = Math.max(0, unrealizedGain);
  if (taxableGain <= 0) return 0;

  return taxableGain * capitalGainsTaxRate;
}
