import type {
  TransformedPosition,
  PositionWithProfitLoss,
  PositionSnapshot,
} from "@/types/global.types";

/**
 * Calculate unrealized P/L using latest snapshot's cost basis and current values.
 * - cost_basis_per_unit: from latest snapshot with basis (fallback to unit_value)
 * - total_cost_basis: cost_basis_per_unit * current_quantity
 * - profit_loss: position.total_value - total_cost_basis
 * - profit_loss_percentage: profit_loss / total_cost_basis (0 if basis is 0)
 */
export function calculateProfitLoss(
  positions: TransformedPosition[],
  snapshotsByPosition: Map<string, PositionSnapshot[]>,
): PositionWithProfitLoss[] {
  return positions.map((position) => {
    const positionSnapshots = snapshotsByPosition.get(position.id) || [];

    if (positionSnapshots.length === 0) {
      return {
        ...position,
        cost_basis_per_unit: 0,
        total_cost_basis: 0,
        profit_loss: 0,
        profit_loss_percentage: 0,
      };
    }

    // Sort once: most recent by date, then by created_at for tie-breakers
    const sorted = [...positionSnapshots].sort((a, b) => {
      const dateDifferenceMs =
        new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDifferenceMs !== 0) return dateDifferenceMs;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    // Prefer latest snapshot linked to a portfolio record with basis;
    // then any snapshot with basis; else fall back to the latest snapshot
    const basisSnapshot =
      sorted.find(
        (s) => s.portfolio_record_id && s.cost_basis_per_unit != null,
      ) ??
      sorted.find((s) => s.cost_basis_per_unit != null) ??
      sorted[0];

    const costBasisPerUnit = (basisSnapshot.cost_basis_per_unit ??
      basisSnapshot.unit_value ??
      0) as number;

    const currentQuantity = position.current_quantity || 0;
    const currentTotalValue = position.total_value || 0;

    const totalCostBasis = costBasisPerUnit * currentQuantity;
    const profitLoss = currentTotalValue - totalCostBasis;
    const profitLossPct = totalCostBasis > 0 ? profitLoss / totalCostBasis : 0;

    return {
      ...position,
      cost_basis_per_unit: costBasisPerUnit,
      total_cost_basis: totalCostBasis,
      profit_loss: profitLoss,
      profit_loss_percentage: profitLossPct,
    };
  });
}
