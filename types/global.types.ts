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
  | "quantity"
  | "current_value"
  | "description"
> & {
  asset_categories: Pick<Tables<"asset_categories">, "name">;
};

//Asset Category
export type AssetCategory = Pick<Tables<"asset_categories">, "name">;
