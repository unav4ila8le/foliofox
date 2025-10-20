import type { Tables } from "@/types/database.types";

// Profile
export type Profile = Pick<
  Tables<"profiles">,
  "username" | "display_currency" | "avatar_url"
>;

// Currency
export type Currency = Pick<Tables<"currencies">, "alphabetic_code" | "name">;

// Positions
export type Position = Tables<"positions">;

export type TransformedPosition = Position & {
  is_archived: boolean;
  category_name?: string;
  current_quantity: number;
  current_unit_value: number;
  total_value: number;
  symbol_id: string | null;
  domain_id: string | null;
  cost_basis_per_unit?: number | null;
};

export type PositionWithProfitLoss = TransformedPosition & {
  profit_loss: number;
  profit_loss_percentage: number;
  total_cost_basis: number;
};

// Portfolio Record
export type PortfolioRecord = Tables<"portfolio_records">;

export type PortfolioRecordWithPosition = PortfolioRecord & {
  positions: Pick<
    Tables<"positions">,
    "id" | "name" | "currency" | "type" | "archived_at"
  >;
};

// Position Snapshots
export type PositionSnapshot = Tables<"position_snapshots">;

export type TransformedPositionSnapshot = PositionSnapshot & {
  total_value: number;
  currency: string;
};

// Position Categories
export type PositionCategory = Tables<"position_categories">;

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
