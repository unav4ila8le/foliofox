import { Archive } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EditAssetButton } from "./edit-asset-button";

import type { TransformedPosition, Symbol } from "@/types/global.types";

export async function AssetHeader({
  position,
  symbol,
}: {
  position: TransformedPosition;
  symbol: Symbol | null;
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
    </div>
  );
}
