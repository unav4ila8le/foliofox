import { Archive, Info } from "lucide-react";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { StaleBadge } from "@/components/dashboard/positions/asset/stale-badge";
import { EditAssetButton } from "./edit-asset-button";
import { AssetMoreActionsButton } from "./asset-more-actions-button";

import { calculateCapitalGainsTaxAmount } from "@/server/analysis/net-worth/capital-gains-tax";
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from "@/lib/number-format";
import { getRequestLocale } from "@/lib/locale/resolve-locale";
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
  const locale = await getRequestLocale();
  const estimatedCapitalGainsTax = calculateCapitalGainsTaxAmount({
    positionType: position.type,
    capitalGainsTaxRate: position.capital_gains_tax_rate,
    unrealizedGain: positionWithProfitLoss.profit_loss,
  });
  const positionValueAfterTax = Math.max(
    0,
    position.total_value - estimatedCapitalGainsTax,
  );

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
          <EditAssetButton
            position={position}
            currentSymbolTicker={symbol?.ticker}
          />
          <AssetMoreActionsButton position={position} />
        </div>
      </div>

      {/* Symbol details */}
      {symbol && (
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <p>
            Ticker Symbol
            <span className="text-foreground ml-1 font-medium">
              {symbol.ticker}
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
                {formatNumber(position.current_quantity, {
                  locale,
                  maximumFractionDigits: 6,
                })}
              </p>
            </div>
            <div>
              <div className="text-muted-foreground flex items-center gap-1">
                Market Price
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5" aria-label="Market price help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Market prices and exchange rates are updated daily at 10:00
                    PM UTC.
                    <br />
                    Data shown is from the previous trading day.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1.5 font-semibold">
                {formatCurrency(
                  position.current_unit_value,
                  position.currency,
                  {
                    locale,
                  },
                )}
                <StaleBadge positionId={position.id} label="Stale" />
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Cost Basis</p>
              <p className="font-semibold">
                {formatCurrency(
                  positionWithProfitLoss.cost_basis_per_unit ?? 0,
                  position.currency,
                  { locale },
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
                  { locale },
                )}
                <span className="ml-1">
                  (
                  {formatPercentage(
                    positionWithProfitLoss.profit_loss_percentage,
                    { locale },
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
                {formatNumber(position.current_quantity, {
                  locale,
                  maximumFractionDigits: 6,
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Unit Value</p>
              <p className="font-semibold">
                {formatCurrency(
                  position.current_unit_value,
                  position.currency,
                  {
                    locale,
                  },
                )}
              </p>
            </div>
          </>
        )}
      </div>

      {/* After-tax information */}
      {position.capital_gains_tax_rate != null ? (
        <div className="bg-card text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border px-4 py-2 text-xs">
          <p>
            Est. Capital Gains Tax
            <span className="text-foreground ml-1 font-medium">
              -
              {formatCurrency(estimatedCapitalGainsTax, position.currency, {
                locale,
              })}
            </span>
          </p>
          <p>
            Value After Tax
            <span className="text-foreground ml-1 font-medium">
              {formatCurrency(positionValueAfterTax, position.currency, {
                locale,
              })}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
