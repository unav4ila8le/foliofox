import type { PositionWithProfitLoss } from "@/types/global.types";

// Private assets table only; tags never enter shared portfolio payloads.
export type AssetTableRow = PositionWithProfitLoss & { tagIds: string[] };
