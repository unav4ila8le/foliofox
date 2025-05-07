import type { Tables } from "@/types/database.types";

export type Profile = Pick<
  Tables<"profiles">,
  "username" | "display_currency" | "avatar_url"
>;

export type Currency = Pick<Tables<"currencies">, "alphabetic_code">;

export type Holding = Pick<
  Tables<"holdings">,
  | "id"
  | "name"
  | "category_code"
  | "currency"
  | "quantity"
  | "current_value"
  | "description"
>;

export type AssetCategory = Tables<"asset_categories">;
