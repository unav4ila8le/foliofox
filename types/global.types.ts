import type { Tables, TablesInsert } from "@/types/database.types";

// Profile
export type Profile = Tables<"profiles">;

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
  has_market_data: boolean;
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
  position_snapshots?:
    | Pick<
        Tables<"position_snapshots">,
        "id" | "cost_basis_per_unit" | "date" | "created_at"
      >
    | Array<
        Pick<
          Tables<"position_snapshots">,
          "id" | "cost_basis_per_unit" | "date" | "created_at"
        >
      >
    | null;
};

export type PortfolioRecordsPage = {
  records: PortfolioRecordWithPosition[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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
export type Symbol = Tables<"symbols">;

export type SymbolAlias = Tables<"symbol_aliases">;

export type SymbolInsert = TablesInsert<"symbols">;

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

// Public portfolio sharing
export type PublicPortfolio = Tables<"public_portfolios">;

export type PublicPortfolioMetadata = {
  id: string;
  slug: string;
  shareUrl: string;
  expiresAt: string | null;
  isActive: boolean;
  neverExpires: boolean;
};

export type PublicPortfolioWithProfile = {
  publicPortfolio: PublicPortfolio;
  profile: Pick<
    Tables<"profiles">,
    "user_id" | "username" | "display_currency" | "avatar_url"
  >;
  isActive: boolean;
};

export type PublicPortfolioExpirationOption = "24h" | "7d" | "30d" | "never";

// Financial Profile
export type FinancialProfile = Tables<"financial_profiles">;
