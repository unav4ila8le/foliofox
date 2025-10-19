import type { Tables } from "@/types/database.types";

// Profile
export type Profile = Pick<
  Tables<"profiles">,
  "username" | "display_currency" | "avatar_url"
>;

// Currency
export type Currency = Pick<Tables<"currencies">, "alphabetic_code" | "name">;

// Holding
export type Holding = Tables<"holdings"> & {
  asset_categories: Pick<Tables<"asset_categories">, "name" | "display_order">;
};

export type TransformedHolding = Holding & {
  is_archived: boolean;
  asset_type: string;
  symbol_id: string | null;
  domain_id: string | null;
  current_quantity: number;
  current_unit_value: number;
  total_value: number;
};

export type HoldingWithCostBasis = TransformedHolding & {
  cost_basis_per_unit: number;
  total_cost_basis: number;
};

export type HoldingWithProfitLoss = HoldingWithCostBasis & {
  profit_loss: number;
  profit_loss_percentage: number;
};

// Transaction
export type Transaction = Tables<"transactions">;

export type TransactionWithHolding = Transaction & {
  holdings: Pick<
    Tables<"holdings">,
    "id" | "name" | "currency" | "archived_at"
  >;
};

// Record
export type Record = Tables<"records">;

export type TransformedRecord = Record & {
  total_value: number;
  currency: string;
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

// Dividend
export type Dividend = Tables<"dividends">;

export type DividendEvent = Tables<"dividend_events">;

export type ProjectedIncomeData = {
  date: Date;
  income: number;
};

// Positions (new model)
export type Position = Tables<"positions">;
export type PositionCategory = Tables<"position_categories">;
export type PositionSnapshot = Tables<"position_snapshots">;
export type PortfolioRecord = Tables<"portfolio_records">;

// Position Sources (hub + per-type)
export type PositionSource = Tables<"position_sources">;
export type SourceSymbol = Tables<"source_symbols">;
export type SourceDomain = Tables<"source_domains">;
export type PositionSourcesFlat = Tables<"position_sources_flat">;

// UI-friendly transformed position shape (successor of TransformedHolding)
export type TransformedPosition = Position & {
  is_archived: boolean;
  category_name?: string;
  current_quantity: number;
  current_unit_value: number;
  total_value: number;
  symbol_id: string | null;
  domain_id: string | null;
};

// Portfolio record enriched for UI (successor of TransformedRecord)
export type TransformedPortfolioRecord = PortfolioRecord & {
  total_value: number;
  currency: string;
};
