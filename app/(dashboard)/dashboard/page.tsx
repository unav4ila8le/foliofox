import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { differenceInCalendarDays, subMonths } from "date-fns";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { Greetings } from "@/components/dashboard/greetings";
import { MarketDataDisclaimer } from "@/components/dashboard/market-data-disclaimer";
import { AssetAllocationDonut } from "@/components/dashboard/charts/asset-allocation-donut";
import { NetWorthAreaChart } from "@/components/dashboard/charts/net-worth-area";
import { NewsWidget } from "@/components/dashboard/news/widget";
import { ProjectedIncomeWidget } from "@/components/dashboard/charts/projected-income/widget";
import { PortfolioRecordsWidget } from "@/components/dashboard/portfolio-records/widget";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchProfile } from "@/server/profile/actions";
import { fetchPositions } from "@/server/positions/fetch";
import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import { fetchNetWorthHistory } from "@/server/analysis/net-worth/net-worth-history";
import { fetchNetWorthChange } from "@/server/analysis/net-worth/net-worth-change";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";
import { fetchPortfolioNews } from "@/server/news/fetch";
import {
  calculateProjectedIncome,
  calculateProjectedIncomeByAsset,
} from "@/server/analysis/projected-income/projected-income";
import { fetchPortfolioRecords } from "@/server/portfolio-records/fetch";

// Separate components for data fetching with suspense
async function GreetingsWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();

  return <Greetings username={profile.username} />;
}

// Net Worth
async function NetWorthChartWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();

  const today = new Date();
  const defaultDaysBack =
    differenceInCalendarDays(today, subMonths(today, 3)) + 1;
  // Fetch both history and change for default period (3 calendar months)
  const [netWorth, netWorthHistory, netWorthChange] = await Promise.all([
    calculateNetWorth(profile.display_currency),
    fetchNetWorthHistory({
      targetCurrency: profile.display_currency,
      daysBack: defaultDaysBack,
    }),
    fetchNetWorthChange({
      targetCurrency: profile.display_currency,
      daysBack: defaultDaysBack,
    }),
  ]);

  return (
    <NetWorthAreaChart
      currency={profile.display_currency}
      netWorth={netWorth}
      history={netWorthHistory}
      change={netWorthChange}
    />
  );
}

// Asset Allocation
async function AssetAllocationChartWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();
  const [netWorth, assetAllocation] = await Promise.all([
    calculateNetWorth(profile.display_currency),
    calculateAssetAllocation(profile.display_currency),
  ]);

  return (
    <AssetAllocationDonut
      currency={profile.display_currency}
      netWorth={netWorth}
      assetAllocation={assetAllocation}
    />
  );
}

// News
async function NewsWidgetWrapper() {
  "use cache: private";
  cacheLife("minutes");
  await getCurrentUser();
  const newsResult = await fetchPortfolioNews(12);

  return <NewsWidget newsData={newsResult} />;
}

// Projected Income
async function ProjectedIncomeWidgetWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();
  const [projectedData, projectedIncomeByAsset] = await Promise.all([
    calculateProjectedIncome(profile.display_currency),
    calculateProjectedIncomeByAsset(profile.display_currency),
  ]);

  return (
    <ProjectedIncomeWidget
      projectedIncome={projectedData}
      projectedIncomeByAsset={projectedIncomeByAsset}
      currency={profile.display_currency}
    />
  );
}

// Portfolio Records
async function PortfolioRecordsWidgetWrapper() {
  "use cache: private";
  const [portfolioRecordsPage, positions] = await Promise.all([
    fetchPortfolioRecords({ pageSize: 15 }),
    fetchPositions({ positionType: "asset" }),
  ]);

  return (
    <PortfolioRecordsWidget
      portfolioRecordsData={portfolioRecordsPage.records}
      hasPositions={positions.length > 0}
      // Pass pagination so the widget summary reflects total records.
      pagination={{
        page: portfolioRecordsPage.page,
        pageSize: portfolioRecordsPage.pageSize,
        pageCount: portfolioRecordsPage.pageCount,
        total: portfolioRecordsPage.total,
        hasNextPage: portfolioRecordsPage.hasNextPage,
        hasPreviousPage: portfolioRecordsPage.hasPreviousPage,
      }}
    />
  );
}

// Main page component
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Suspense
            fallback={<h1 className="text-2xl font-semibold">Welcome Back</h1>}
          >
            <GreetingsWrapper />
          </Suspense>
          <p className="text-muted-foreground">Here&apos;s your summary</p>
        </div>
        <MarketDataDisclaimer />
      </div>
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-6 xl:col-span-4">
          <Suspense fallback={<Skeleton className="h-80" />}>
            <NetWorthChartWrapper />
          </Suspense>
        </div>
        <div className="col-span-6 lg:col-span-3 xl:col-span-2">
          <Suspense fallback={<Skeleton className="h-80" />}>
            <AssetAllocationChartWrapper />
          </Suspense>
        </div>
        <div className="col-span-6 lg:col-span-3">
          <Suspense fallback={<Skeleton className="h-80" />}>
            <NewsWidgetWrapper />
          </Suspense>
        </div>
        <div className="col-span-6 xl:col-span-3">
          <Suspense fallback={<Skeleton className="h-80" />}>
            <ProjectedIncomeWidgetWrapper />
          </Suspense>
        </div>
        <div className="col-span-6">
          <Suspense fallback={<Skeleton className="h-80" />}>
            <PortfolioRecordsWidgetWrapper />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
