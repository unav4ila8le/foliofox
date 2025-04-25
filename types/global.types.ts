import type { Tables } from "@/types/database.types";

export type Profile = Pick<
  Tables<"profiles">,
  "username" | "display_currency" | "avatar_url"
>;

export type Currency = Pick<Tables<"currencies">, "alphabetic_code">;
