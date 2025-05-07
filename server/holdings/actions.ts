"use server";

import { getCurrentUser } from "@/server/auth/actions";

import type { Holding } from "@/types/global.types";

// Fetch holdings
export async function fetchHoldings() {
  const { supabase, user } = await getCurrentUser();

  const { data: holdings, error } = await supabase
    .from("holdings")
    .select("name, category_code, currency, current_value, description")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return holdings as Holding[];
}
