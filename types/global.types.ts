import type { Tables } from "@/types/database.types";

// Profile
export type Profile = Pick<
  Tables<"profiles">,
  "username" | "display_currency" | "avatar_url"
>;

// Currency
export type Currency = Pick<Tables<"currencies">, "alphabetic_code" | "name">;

// Holding
export type Holding = Pick<
  Tables<"holdings">,
  | "id"
  | "name"
  | "category_code"
  | "symbol_id"
  | "currency"
  | "description"
  | "is_archived"
  | "archived_at"
> & {
  asset_categories: Pick<Tables<"asset_categories">, "name" | "display_order">;
};

export type TransformedHolding = Holding & {
  asset_type: string;
  current_quantity: number;
  current_unit_value: number;
  total_value: number;
};

export type HoldingWithProfitLoss = TransformedHolding & {
  profit_loss: number;
  profit_loss_percentage: number;
};

// Record
export type Record = Tables<"records">;

export type TransformedRecord = Record & {
  total_value: number;
};

// Asset Category
export type AssetCategory = Tables<"asset_categories">;

// Exchange Rate
export type ExchangeRate = Tables<"exchange_rates">;

// Symbol
export type Symbol = Pick<
  Tables<"symbols">,
  | "id"
  | "quote_type"
  | "short_name"
  | "long_name"
  | "exchange"
  | "currency"
  | "industry"
  | "sector"
>;

export type SymbolSearchResult = {
  id: string;
  nameDisp: string;
  exchange: string | null;
  typeDisp: string;
};

// Quote
export type Quote = Pick<
  Tables<"quotes">,
  "id" | "symbol_id" | "date" | "price"
>;

// News
export type NewsArticle = Tables<"news">;
