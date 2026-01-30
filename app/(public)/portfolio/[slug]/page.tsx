import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { Logomark } from "@/components/ui/logos/logomark";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicPortfolioHeader } from "@/components/public-portfolio/header";
import { PublicPortfolioAssetsTable } from "@/components/public-portfolio/assets-table";
import { AssetAllocationDonutPublic } from "@/components/dashboard/charts/asset-allocation-donut";
import { ProjectedIncomeWidget } from "@/components/dashboard/charts/projected-income/widget";

import { fetchPublicPortfolioBySlug } from "@/server/public-portfolios/fetch";
import { createServiceClient } from "@/supabase/service";
import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";
import {
  calculateProjectedIncome,
  calculateProjectedIncomeByAsset,
} from "@/server/analysis/projected-income/projected-income";
import { fetchPositions } from "@/server/positions/fetch";
import { calculateProfitLoss } from "@/lib/profit-loss";
import { getRequestLocale } from "@/lib/locale/resolve-locale";

import type { PositionsQueryContext } from "@/server/positions/fetch";

// --- Metadata Generation ---

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const resolved = await fetchPublicPortfolioBySlug(slug);

  if (!resolved || !resolved.isActive) {
    return {
      title: "Public Portfolio",
      description: "View this public portfolio on Foliofox.",
    };
  }

  const { profile } = resolved;
  const username = profile.username;

  return {
    title: `${username}'s Portfolio`,
    description: `View ${username}'s public portfolio on Foliofox. Track positions, asset allocation, and performance insights.`,
  };
}

// --- Wrapper Components ---

async function AssetAllocationWrapper({
  userId,
  currency,
}: {
  userId: string;
  currency: string;
}) {
  "use cache";

  const supabaseClient = createServiceClient();
  const context: PositionsQueryContext = { supabaseClient, userId };
  const asOfDate = new Date();

  const [netWorth, assetAllocation] = await Promise.all([
    calculateNetWorth(currency, asOfDate, context),
    calculateAssetAllocation(currency, asOfDate, context),
  ]);

  return (
    <AssetAllocationDonutPublic
      netWorth={netWorth}
      currency={currency}
      assetAllocation={assetAllocation}
      className="h-72!"
    />
  );
}

async function ProjectedIncomeWrapper({
  userId,
  currency,
}: {
  userId: string;
  currency: string;
}) {
  "use cache";

  const supabaseClient = createServiceClient();
  const context: PositionsQueryContext = { supabaseClient, userId };

  const [projectedIncomeResult, projectedIncomeByAsset] = await Promise.all([
    calculateProjectedIncome(currency, 12, context),
    calculateProjectedIncomeByAsset(currency, 12, context),
  ]);

  // Keep stacked data ready for the upcoming chart without UI changes yet.
  void projectedIncomeByAsset;

  return (
    <ProjectedIncomeWidget
      projectedIncome={{
        success: projectedIncomeResult.success,
        data: projectedIncomeResult.data ?? [],
        message: projectedIncomeResult.message,
        currency: projectedIncomeResult.currency ?? currency,
      }}
      currency={projectedIncomeResult.currency ?? currency}
      className="h-72!"
    />
  );
}

async function PositionsWrapper({
  userId,
  locale,
}: {
  userId: string;
  locale: string;
}) {
  "use cache";

  const supabaseClient = createServiceClient();
  const context: PositionsQueryContext = { supabaseClient, userId };
  const asOfDate = new Date();

  const positionsResult = await fetchPositions(
    {
      positionType: "asset",
      asOfDate: asOfDate,
      includeSnapshots: true,
    },
    context,
  );

  const positionsWithProfitLoss = calculateProfitLoss(
    positionsResult.positions,
    positionsResult.snapshots,
  );

  return (
    <PublicPortfolioAssetsTable
      positions={positionsWithProfitLoss}
      locale={locale}
    />
  );
}

// --- Main Page Component ---

export default async function PublicPortfolioPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ currency?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [{ slug }, search] = await Promise.all([params, searchParams]);

  // 1. Fetch metadata first (fast)
  const resolved = await fetchPublicPortfolioBySlug(slug);
  const locale = await getRequestLocale();

  if (!resolved) {
    notFound();
  }

  const { profile } = resolved;

  // 2. Handle expired state
  if (!resolved.isActive) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Link href="/" aria-label="Foliofox - Go to homepage">
          <Logomark
            height={64}
            className="text-muted-foreground/20 hover:text-brand transition-colors"
          />
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Link expired</h1>
        <p className="text-muted-foreground mt-2">
          This shared portfolio link has expired.
          <br />
          Ask the owner to refresh or re-enable public sharing to view the
          latest data.
        </p>
      </div>
    );
  }

  // 3. Determine currency
  function normalizeCurrency(code: string | undefined | string[]) {
    if (!code) return undefined;
    const singleCode = Array.isArray(code) ? code[0] : code;
    const trimmed = singleCode.trim();
    return /^[A-Z]{3}$/.test(trimmed) ? trimmed : undefined;
  }

  const fallbackCurrency = profile.display_currency ?? "USD";
  const targetCurrency =
    normalizeCurrency(search?.currency) ?? fallbackCurrency;

  // 4. Render page with Suspense boundaries
  return (
    <div className="container mx-auto grid w-full max-w-7xl grid-cols-6 gap-4 p-3">
      <div className="col-span-6">
        <PublicPortfolioHeader
          username={profile.username}
          avatarUrl={profile.avatar_url}
          currentCurrency={targetCurrency}
          defaultCurrency={profile.display_currency}
        />
      </div>
      <div className="col-span-6 md:col-span-3">
        <Suspense fallback={<Skeleton className="h-72" />}>
          <AssetAllocationWrapper
            userId={profile.user_id}
            currency={targetCurrency}
          />
        </Suspense>
      </div>
      <div className="col-span-6 md:col-span-3">
        <Suspense fallback={<Skeleton className="h-72" />}>
          <ProjectedIncomeWrapper
            userId={profile.user_id}
            currency={targetCurrency}
          />
        </Suspense>
      </div>
      <div className="col-span-6">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <PositionsWrapper userId={profile.user_id} locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
