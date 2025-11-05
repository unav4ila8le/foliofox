import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { formatNumber, formatPercentage } from "@/lib/number-format";

import type { PositionWithProfitLoss } from "@/types/global.types";

type PublicPortfolioAssetsTableProps = {
  positions: PositionWithProfitLoss[];
};

const hasMarketData = (position: PositionWithProfitLoss) =>
  position.has_market_data === true;

export function PublicPortfolioAssetsTable({
  positions,
}: PublicPortfolioAssetsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground flex items-center justify-center rounded-lg border px-6 py-16 text-center text-sm">
        This portfolio does not contain any assets yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Unit value</TableHead>
            <TableHead className="text-right">Cost basis</TableHead>
            <TableHead className="text-right">P/L</TableHead>
            <TableHead className="text-right">P/L %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => {
            const marketDataAvailable = hasMarketData(position);
            const profitLoss = position.profit_loss ?? 0;
            const profitLossPercent = position.profit_loss_percentage ?? 0;

            return (
              <TableRow key={position.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{position.name}</span>
                    {position.category_name && (
                      <span className="text-muted-foreground text-xs">
                        {position.category_name}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{position.currency}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(position.current_quantity ?? 0, undefined, {
                    maximumFractionDigits: 6,
                  })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(position.current_unit_value ?? 0, undefined, {
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {marketDataAvailable
                    ? formatNumber(
                        position.cost_basis_per_unit ?? 0,
                        undefined,
                        { maximumFractionDigits: 2 },
                      )
                    : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    !marketDataAvailable
                      ? "text-muted-foreground"
                      : profitLoss >= 0
                        ? "text-green-600"
                        : "text-red-600",
                  )}
                >
                  {marketDataAvailable
                    ? formatNumber(profitLoss, undefined, {
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    !marketDataAvailable
                      ? "text-muted-foreground"
                      : profitLossPercent >= 0
                        ? "text-green-600"
                        : "text-red-600",
                  )}
                >
                  {marketDataAvailable
                    ? formatPercentage(profitLossPercent)
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
