import { Suspense } from "react";
import { differenceInCalendarDays, subMonths } from "date-fns";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { Greetings } from "@/components/dashboard/greetings";
import { MarketDataDisclaimer } from "@/components/dashboard/market-data-disclaimer";
import { AssetAllocationDonut } from "@/components/dashboard/charts/asset-allocation-donut";
import { NetWorthAreaChart } from "@/components/dashboard/charts/net-worth-area";
import { NewsWidget } from "@/components/dashboard/news/widget";
import { ProjectedIncomeWidget } from "@/components/dashboard/charts/projected-income/widget";
import { PortfolioRecordsWidget } from "@/components/dashboard/portfolio-records/widget";

import { fetchProfile } from "@/server/profile/actions";
import { calculateNetWorth } from "@/server/analysis/net-worth";
import { fetchNetWorthHistory } from "@/server/analysis/net-worth-history";
import { fetchNetWorthChange } from "@/server/analysis/net-worth-change";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";
import { fetchPortfolioNews } from "@/server/news/fetch";
import { calculateProjectedIncome } from "@/server/analysis/projected-income";
import { fetchPortfolioRecords } from "@/server/portfolio-records/fetch";

// Separate components for data fetching with suspense
async function GreetingsWrapper() {
  const { profile } = await fetchProfile();

  return <Greetings username={profile.username} />;
}

async function NetWorthChartWrapper() {
  const today = new Date();
  const defaultDaysBack =
    differenceInCalendarDays(today, subMonths(today, 6)) + 1;

  const { profile } = await fetchProfile();
  // Fetch both history and change for default period (6 calendar months)
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

async function AssetAllocationChartWrapper() {
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

async function NewsWidgetWrapper() {
  const newsResult = await fetchPortfolioNews(12);

  return <NewsWidget newsData={newsResult} />;
}

async function ProjectedIncomeWidgetWrapper() {
  const { profile } = await fetchProfile();
  const projectedData = await calculateProjectedIncome(
    profile.display_currency,
  );

  return (
    <ProjectedIncomeWidget
      projectedIncome={projectedData}
      currency={profile.display_currency}
    />
  );
}

async function PortfolioRecordsWidgetWrapper() {
  const { records } = await fetchPortfolioRecords({ pageSize: 15 });
  return <PortfolioRecordsWidget portfolioRecordsData={records} />;
}

// Main page component
export default async function DashboardPage() {
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
          <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
            <NetWorthChartWrapper />
          </Suspense>
        </div>
        <div className="col-span-6 lg:col-span-3 xl:col-span-2">
          <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
            <AssetAllocationChartWrapper />
          </Suspense>
        </div>
        <div className="col-span-6 lg:col-span-3">
          <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
            <NewsWidgetWrapper />
          </Suspense>
        </div>
        <div className="col-span-6 xl:col-span-3">
          <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
            <ProjectedIncomeWidgetWrapper />
          </Suspense>
        </div>
        <div className="col-span-6">
          <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
            <PortfolioRecordsWidgetWrapper />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
