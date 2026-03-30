export interface RealizedProfitLossSellRecord {
  positionId: string;
  quantity: number;
  unitValue: number;
  costBasisPerUnit: number | null;
}

export function calculateRealizedProfitLossTotals(
  sellRecords: RealizedProfitLossSellRecord[],
) {
  const realizedProfitLossByPositionId = new Map<string, number>();

  sellRecords.forEach((record) => {
    if (record.costBasisPerUnit == null) {
      return;
    }

    const realizedProfitLoss =
      Number(record.quantity) *
      (Number(record.unitValue) - Number(record.costBasisPerUnit));

    realizedProfitLossByPositionId.set(
      record.positionId,
      (realizedProfitLossByPositionId.get(record.positionId) ?? 0) +
        realizedProfitLoss,
    );
  });

  return realizedProfitLossByPositionId;
}
