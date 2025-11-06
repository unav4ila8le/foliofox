"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import {
  PUBLIC_PORTFOLIO_EXPIRATIONS,
  buildSlugCandidate,
  computeExpiration,
  generateRandomString,
  sanitizeSlug,
  toPublicPortfolioMetadata,
  UNIQUE_VIOLATION_CODE,
} from "@/lib/public-portfolio";

import type { PublicPortfolioExpirationOption } from "@/types/global.types";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchPublicPortfolio, resolveSiteUrl } from "./fetch";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorCode(error: unknown) {
  if (isRecord(error)) {
    const code = error.code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
  }
  return fallback;
}

async function fetchProfileUsername(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Profile not found");
  }

  return data.username ?? "";
}

async function upsertPublicPortfolio(
  supabase: SupabaseClient<Database>,
  payload: Database["public"]["Tables"]["public_portfolios"]["Insert"],
) {
  const { data, error } = await supabase
    .from("public_portfolios")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function enablePublicPortfolio(
  expirationOption: PublicPortfolioExpirationOption,
) {
  const { supabase, user } = await getCurrentUser();

  if (!PUBLIC_PORTFOLIO_EXPIRATIONS.includes(expirationOption)) {
    return {
      success: false as const,
      error: "Invalid expiration option.",
    };
  }

  const existing = await fetchPublicPortfolio(supabase, user.id);
  const baseSlugSource =
    existing?.slug ??
    sanitizeSlug(await fetchProfileUsername(supabase, user.id));
  const baseSlug =
    baseSlugSource.length >= 3 ? baseSlugSource : generateRandomString(8);

  const expiration = computeExpiration(expirationOption);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const slugCandidate = buildSlugCandidate(baseSlug, attempt);
    try {
      const payload = {
        user_id: user.id,
        slug: slugCandidate,
        expires_at: expiration,
      } as Database["public"]["Tables"]["public_portfolios"]["Insert"];
      if (existing?.id) {
        payload.id = existing.id;
      }
      const record = await upsertPublicPortfolio(supabase, payload);

      const siteUrl = await resolveSiteUrl();
      const view = toPublicPortfolioMetadata(record, siteUrl);

      revalidatePath("/dashboard");
      revalidatePath(`/portfolio/${view.slug}`);

      return { success: true as const, data: view };
    } catch (error) {
      if (getErrorCode(error) === UNIQUE_VIOLATION_CODE) {
        continue;
      }

      const message = getErrorMessage(
        error,
        "Failed to enable public portfolio.",
      );
      return { success: false as const, error: message };
    }
  }

  return {
    success: false as const,
    error: "Unable to generate a unique public link. Please try again.",
  };
}
