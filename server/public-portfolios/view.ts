import { createServiceClient } from "@/supabase/service";

import { calculateNetWorth } from "@/server/analysis/net-worth";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";
import { calculateProjectedIncome } from "@/server/analysis/projected-income";
import {
  fetchPositions,
  type PositionsQueryContext,
} from "@/server/positions/fetch";

import { calculateProfitLoss } from "@/lib/profit-loss";
import { toPublicPortfolioMetadata } from "@/lib/public-portfolio";

import type {
  PublicPortfolioMetadata,
  PositionWithProfitLoss,
  ProjectedIncomeData,
} from "@/types/global.types";

import { fetchPublicPortfolioBySlug, resolveSiteUrl } from "./fetch";

export type PublicPortfolioView =
  | {
      status: "active";
      metadata: PublicPortfolioMetadata;
      owner: {
        userId: string;
        username: string | null;
        displayCurrency: string;
        avatarUrl: string | null;
      };
      netWorth: {
        value: number;
        currency: string;
      };
      assetAllocation: Array<{
        category_id: string;
        name: string;
        total_value: number;
      }>;
      projectedIncome: {
        success: boolean;
        currency: string;
        data: ProjectedIncomeData[];
        message?: string;
      };
      positions: PositionWithProfitLoss[];
    }
  | {
      status: "expired";
      metadata: PublicPortfolioMetadata;
    };

function normalizeCurrency(code: string | undefined) {
  if (!code) return undefined;
  const trimmed = code.trim();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : undefined;
}

export async function buildPublicPortfolioView(
  slug: string,
  requestedCurrency?: string,
): Promise<PublicPortfolioView | null> {
  const resolved = await fetchPublicPortfolioBySlug(slug);
  if (!resolved) {
    return null;
  }

  const { publicPortfolio, profile } = resolved;
  const siteUrl = await resolveSiteUrl();
  const metadata = toPublicPortfolioMetadata(publicPortfolio, siteUrl);

  if (!resolved.isActive) {
    return {
      status: "expired",
      metadata,
    };
  }

  const fallbackCurrency = profile.display_currency ?? "USD";
  const targetCurrency =
    normalizeCurrency(requestedCurrency) ?? fallbackCurrency;

  const supabaseClient = createServiceClient();
  const context: PositionsQueryContext = {
    supabaseClient,
    userId: publicPortfolio.user_id,
  };

  const asOfDate = new Date();

  const [netWorth, assetAllocation, projectedIncomeResult, positionsResult] =
    await Promise.all([
      calculateNetWorth(targetCurrency, asOfDate, context),
      calculateAssetAllocation(targetCurrency, asOfDate, context),
      calculateProjectedIncome(targetCurrency, 12, context),
      fetchPositions(
        {
          positionType: "asset",
          asOfDate: asOfDate,
          includeSnapshots: true,
        },
        context,
      ),
    ]);

  const positionsWithProfitLoss = calculateProfitLoss(
    positionsResult.positions,
    positionsResult.snapshots,
  );

  return {
    status: "active",
    metadata,
    owner: {
      userId: profile.user_id,
      username: profile.username ?? null,
      displayCurrency: fallbackCurrency,
      avatarUrl: profile.avatar_url ?? null,
    },
    netWorth: {
      value: netWorth,
      currency: targetCurrency,
    },
    assetAllocation,
    projectedIncome: {
      success: projectedIncomeResult.success,
      currency: projectedIncomeResult.currency ?? targetCurrency,
      data: projectedIncomeResult.data ?? [],
      message: projectedIncomeResult.message,
    },
    positions: positionsWithProfitLoss,
  };
}
