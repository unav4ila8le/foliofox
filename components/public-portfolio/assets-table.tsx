import { Package } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card className="flex h-80 flex-col gap-4 rounded-lg shadow-xs">
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <Package className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Positions</p>
          <p className="text-muted-foreground mt-1 text-sm">
            This portfolio does not contain any positions yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border shadow-xs">
      <Table className="bg-background dark:bg-transparent [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
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
                <TableCell className="max-w-48 md:max-w-64 lg:max-w-80">
                  <div>
                    <Tooltip delayDuration={500}>
                      <TooltipTrigger asChild>
                        <div className="truncate">{position.name}</div>
                      </TooltipTrigger>
                      <TooltipContent>{position.name}</TooltipContent>
                    </Tooltip>
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
                    : "-"}
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
                    : "-"}
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
                    : "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
