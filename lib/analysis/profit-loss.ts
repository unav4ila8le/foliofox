import type {
  TransformedHolding,
  Record,
  HoldingWithProfitLoss,
} from "@/types/global.types";

/**
 * Transform holdings data to include basic P/L calculations.
 */
export function calculateProfitLoss(
  holdings: TransformedHolding[],
  recordsByHolding: Map<string, Record[]>,
): HoldingWithProfitLoss[] {
  return holdings.map((holding) => {
    const holdingRecords = recordsByHolding.get(holding.id) || [];

    if (holdingRecords.length === 0) {
      return {
        ...holding,
        profit_loss: 0,
        profit_loss_percentage: 0,
      };
    }

    // Sort records by date to get first (earliest) record
    const sortedRecords = [...holdingRecords].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const firstRecord = sortedRecords[0];
    const first_value = firstRecord.quantity * firstRecord.unit_value;
    const current_value = holding.total_value;

    // Simple change from first record
    const profit_loss = current_value - first_value;
    const profit_loss_percentage =
      first_value > 0 ? profit_loss / first_value : 0;

    return {
      ...holding,
      profit_loss,
      profit_loss_percentage,
    };
  });
}
