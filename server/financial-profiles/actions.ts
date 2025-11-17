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

  // Extract form data
  const financialProfileData: Pick<
    FinancialProfile,
    | "data_sharing_consent"
    | "age_band"
    | "income_amount"
    | "income_currency"
    | "risk_preference"
    | "about"
  > = {
    data_sharing_consent: Boolean(formData.get("data_sharing_consent")),
    age_band: formData.get("age_band") as (typeof AGE_BANDS)[number] | null,
    income_amount: formData.get("income_amount") as number | null,
    income_currency: formData.get("income_currency") as string | null,
    risk_preference: formData.get("risk_preference") as
      | (typeof RISK_PREFERENCES)[number]
      | null,
    about: formData.get("about") as string | null,
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
