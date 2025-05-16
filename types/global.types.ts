import type { Tables } from "@/types/database.types";

//Profile
export type Profile = Pick<
  Tables<"profiles">,
  "username" | "display_currency" | "avatar_url"
>;

//Currency
export type Currency = Pick<Tables<"currencies">, "alphabetic_code">;

//Holding
export type Holding = Pick<
  Tables<"holdings">,
  | "id"
  | "name"
  | "category_code"
  | "currency"
  | "current_quantity"
  | "current_value"
  | "description"
> & {
  asset_categories: Pick<Tables<"asset_categories">, "name" | "display_order">;
};

//Asset Category
export type AssetCategory = Tables<"asset_categories">;

//Holding Quantity
export type HoldingQuantity = Tables<"holding_quantities">;

//Holding Valuation
export type HoldingValuation = Tables<"holding_valuations">;

//Exchange Rate
export type ExchangeRate = Tables<"exchange_rates">;
