"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import {
  PUBLIC_PORTFOLIO_EXPIRATIONS,
  computeExpiration,
  sanitizeSlug,
  toPublicPortfolioMetadata,
  UNIQUE_VIOLATION_CODE,
} from "@/lib/public-portfolio";

import type { PublicPortfolioExpirationOption } from "@/types/global.types";

import { fetchPublicPortfolio, resolveSiteUrl } from "./fetch";

export async function updatePublicPortfolioSettings(
  newSlug: string,
  expirationOption: PublicPortfolioExpirationOption,
) {
  const { supabase, user } = await getCurrentUser();

  if (!PUBLIC_PORTFOLIO_EXPIRATIONS.includes(expirationOption)) {
    return {
      success: false as const,
      error: "Invalid expiration option.",
    };
  }

  const sanitized = sanitizeSlug(newSlug);
  if (!sanitized) {
    return {
      success: false as const,
      error: "Slug must contain only letters and numbers.",
    };
  }
  if (sanitized.length < 3) {
    return {
      success: false as const,
      error: "Slug must be at least 3 characters.",
    };
  }

  const existing = await fetchPublicPortfolio(supabase, user.id);
  if (!existing) {
    return {
      success: false as const,
      error: "Enable public sharing before updating the slug.",
    };
  }

  const { data, error } = await supabase
    .from("public_portfolios")
    .update({
      slug: sanitized,
      expires_at: computeExpiration(expirationOption),
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION_CODE) {
      return {
        success: false as const,
        error: "This slug is already taken. Try another.",
      };
    }

    return {
      success: false as const,
      error: error?.message ?? "Failed to update public portfolio slug.",
    };
  }

  const siteUrl = await resolveSiteUrl();
  const currentView = toPublicPortfolioMetadata(data, siteUrl);

  revalidatePath("/dashboard");
  revalidatePath(`/portfolio/${existing.slug}`);
  revalidatePath(`/portfolio/${currentView.slug}`);

  return { success: true as const, data: currentView };
}
