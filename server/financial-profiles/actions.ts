"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type { FinancialProfile } from "@/types/global.types";
import { AGE_BANDS, RISK_PREFERENCES } from "@/types/enums";

export const fetchFinancialProfile = cache(async () => {
  const { supabase, user } = await getCurrentUser();

  const { data: financialProfile, error } = await supabase
    .from("financial_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!financialProfile) {
    return null;
  }

  return financialProfile;
});

export async function upsertFinancialProfile(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  const pickStringOrNull = (name: string) => {
    const raw = formData.get(name);
    if (raw === null) return null;
    const value = String(raw).trim();
    return value === "" ? null : value;
  };

  const pickNumberOrNull = (name: string) => {
    const raw = pickStringOrNull(name);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  };

  // Extract form data
  const financialProfileData: Pick<
    FinancialProfile,
    | "age_band"
    | "income_amount"
    | "income_currency"
    | "risk_preference"
    | "about"
  > = {
    age_band: pickStringOrNull("age_band") as (typeof AGE_BANDS)[number] | null,
    income_amount: pickNumberOrNull("income_amount"),
    income_currency: pickStringOrNull("income_currency"),
    risk_preference: pickStringOrNull("risk_preference") as
      | (typeof RISK_PREFERENCES)[number]
      | null,
    about: pickStringOrNull("about"),
  };

  const { error } = await supabase
    .from("financial_profiles")
    .upsert(
      { user_id: user.id, ...financialProfileData },
      { onConflict: "user_id" },
    );

  if (error) {
    return { success: false, error: error.message } as const;
  }

  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}
