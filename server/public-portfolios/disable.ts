"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import { toPublicPortfolioMetadata } from "@/lib/public-portfolio";

import { fetchPublicPortfolio, resolveSiteUrl } from "./fetch";

export async function disablePublicPortfolio() {
  const { supabase, user } = await getCurrentUser();

  const existing = await fetchPublicPortfolio(supabase, user.id);
  if (!existing) {
    return {
      success: false as const,
      error: "Public sharing is not enabled yet.",
    };
  }

  const { data, error } = await supabase
    .from("public_portfolios")
    .update({ expires_at: null })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false as const,
      error: error?.message ?? "Failed to disable public portfolio.",
    };
  }

  const siteUrl = await resolveSiteUrl();
  const view = toPublicPortfolioMetadata(data, siteUrl);

  revalidatePath("/dashboard");
  revalidatePath(`/portfolio/${view.slug}`);

  return { success: true as const, data: view };
}
