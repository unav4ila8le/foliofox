import { Archive } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EditHoldingButton } from "@/components/dashboard/holdings/edit-holding-button";

import type { TransformedHolding, Symbol } from "@/types/global.types";

export async function HoldingHeader({
  holding,
  symbol,
}: {
  holding: TransformedHolding;
  symbol: Symbol | null;
}) {
  return (
    <div className="space-y-2">
      {/* Holding name and type */}
      <div className="flex flex-col flex-wrap items-start gap-2 md:flex-row md:items-center">
        <h1 className="text-2xl font-semibold">{holding.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{holding.asset_type}</Badge>
          {holding.is_archived && (
            <Badge variant="secondary">
              <Archive className="size-4" /> Archived
            </Badge>
          )}
          <EditHoldingButton holding={holding} />
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

      {/* Holding description */}
      {holding.description && (
        <p className="text-muted-foreground">{holding.description}</p>
      )}
    </div>
  );
}
