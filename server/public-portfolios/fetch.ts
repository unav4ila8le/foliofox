"use server";

import { cache } from "react";
import { headers } from "next/headers";

import { getCurrentUser } from "@/server/auth/actions";
import { createServiceClient } from "@/supabase/service";

import {
  isPortfolioActive,
  sanitizeSlug,
  toPublicPortfolioMetadata,
} from "@/lib/public-portfolio";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  PublicPortfolio,
  PublicPortfolioMetadata,
  PublicPortfolioWithProfile,
} from "@/types/global.types";

export async function fetchPublicPortfolio(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PublicPortfolio | null> {
  const { data, error } = await supabase
    .from("public_portfolios")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function resolveSiteUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    if (host) {
      const protocol =
        headerStore.get("x-forwarded-proto") ??
        (host.includes("localhost") ? "http" : "https");
      return `${protocol}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // Ignore header resolution issues – fall back below.
  }

  return "http://localhost:3000";
}

export async function fetchCurrentPublicPortfolio(): Promise<PublicPortfolioMetadata | null> {
  const { supabase, user } = await getCurrentUser();
  const record = await fetchPublicPortfolio(supabase, user.id);
  if (!record) return null;

  const siteUrl = await resolveSiteUrl();
  return toPublicPortfolioMetadata(record, siteUrl);
}

export const fetchPublicPortfolioBySlug = cache(
  async (slug: string): Promise<PublicPortfolioWithProfile | null> => {
    const sanitized = sanitizeSlug(slug);
    if (!sanitized) return null;

    const supabase = createServiceClient();

    const { data: publicPortfolio, error } = await supabase
      .from("public_portfolios")
      .select("*")
      .eq("slug", sanitized)
      .maybeSingle();

    if (error || !publicPortfolio) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, username, display_currency, avatar_url")
      .eq("user_id", publicPortfolio.user_id)
      .maybeSingle();

    if (profileError || !profile) return null;

    return {
      publicPortfolio,
      profile,
      isActive: isPortfolioActive(publicPortfolio.expires_at),
    };
  },
);
