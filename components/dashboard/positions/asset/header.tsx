import { Archive, Info } from "lucide-react";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { EditAssetButton } from "./edit-asset-button";
import { AssetMoreActionsButton } from "./asset-more-actions-button";

import { formatCurrency, formatPercentage } from "@/lib/number-format";
import { cn } from "@/lib/utils";

import type {
  TransformedPosition,
  Symbol,
  PositionWithProfitLoss,
} from "@/types/global.types";

export async function AssetHeader({
  position,
  symbol,
  positionWithProfitLoss,
}: {
  position: TransformedPosition;
  symbol: Symbol | null;
  positionWithProfitLoss: PositionWithProfitLoss;
}) {
  return (
    <div className="space-y-2">
      {/* Asset name and type */}
      <div className="flex flex-col flex-wrap items-start gap-2 md:flex-row md:items-center">
        <h1 className="text-2xl font-semibold">{position.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{position.category_name}</Badge>
          {position.is_archived && (
            <Badge variant="secondary">
              <Archive className="size-4" /> Archived
            </Badge>
          )}
          <EditAssetButton position={position} />
          <AssetMoreActionsButton position={position} />
        </div>
      </div>

      {/* Symbol details */}
      {symbol && (
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <p>
            Ticker Symbol
            <span className="text-foreground ml-1 font-medium">
              {symbol.id}
            </span>
          </p>
          {symbol.exchange && (
            <p>
              Exchange
              <span className="text-foreground ml-1 font-medium">
                {symbol.exchange}
              </span>
            </p>
          )}
          {symbol.currency && (
            <p>
              Currency
              <span className="text-foreground ml-1 font-medium">
                {symbol.currency}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Position description */}
      {position.description && (
        <p className="text-muted-foreground">{position.description}</p>
      )}

      <div className="bg-card mt-3 grid grid-cols-2 gap-4 rounded-lg border px-4 py-2 text-sm md:grid-cols-4">
        {/* Position market data and profit/loss */}
        {position.has_market_data ? (
          <>
            <div>
              <p className="text-muted-foreground">Quantity</p>
              <p className="font-semibold">
                {position.current_quantity.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">
                Market Price{" "}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className="inline-block size-3.5"
                      aria-label="Market price help"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Market prices and exchange rates are updated daily at 10:00
                    PM UTC.
                    <br />
                    Data shown is from the previous trading day.
                  </TooltipContent>
                </Tooltip>
              </p>
              <p className="font-semibold">
                {formatCurrency(position.current_unit_value, position.currency)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost Basis</p>
              <p className="font-semibold">
                {formatCurrency(
                  positionWithProfitLoss.cost_basis_per_unit ?? 0,
                  position.currency,
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">P/L (%)</p>
              <p
                className={cn(
                  "font-semibold",
                  positionWithProfitLoss.profit_loss >= 0
                    ? "text-green-600"
                    : "text-red-600",
                )}
              >
                {formatCurrency(
                  positionWithProfitLoss.profit_loss,
                  position.currency,
                )}
                <span className="ml-1">
                  (
                  {formatPercentage(
                    positionWithProfitLoss.profit_loss_percentage,
                  )}
                  )
                </span>
              </p>
            </div>
          </>
        ) : (
          // No market data available
          <>
            <div>
              <p className="text-muted-foreground">Quantity</p>
              <p className="font-semibold">
                {position.current_quantity.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Unit Value</p>
              <p className="font-semibold">
                {formatCurrency(position.current_unit_value, position.currency)}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
