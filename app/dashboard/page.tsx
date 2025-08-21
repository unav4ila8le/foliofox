import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Greetings } from "@/components/dashboard/greetings";
import { MarketDataDisclaimer } from "@/components/dashboard/market-data-disclaimer";
import { AssetAllocationDonut } from "@/components/dashboard/charts/asset-allocation-donut";
import { NetWorthLineChart } from "@/components/dashboard/charts/net-worth-line";
import { NewsWidget } from "@/components/dashboard/news/widget";
import { ProjectedIncomeWidget } from "@/components/dashboard/projected-income/widget";

import { fetchProfile } from "@/server/profile/actions";
import { calculateNetWorth } from "@/server/analysis/net-worth";
import { fetchNetWorthHistory } from "@/server/analysis/net-worth-history";
import { fetchNetWorthChange } from "@/server/analysis/net-worth-change";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";
import { fetchPortfolioNews } from "@/server/news/fetch";

// Separate components for data fetching with suspense
async function NetWorthChartWrapper({
  displayCurrency,
  netWorth,
}: {
  displayCurrency: string;
  netWorth: number;
}) {
  // Fetch both history and change for default period (24 weeks)
  const [netWorthHistory, netWorthChange] = await Promise.all([
    fetchNetWorthHistory({
      targetCurrency: displayCurrency,
    }),
    fetchNetWorthChange({
      targetCurrency: displayCurrency,
    }),
  ]);

  return (
    <NetWorthLineChart
      currency={displayCurrency}
      netWorth={netWorth}
      history={netWorthHistory}
      change={netWorthChange}
    />
  );
}

async function AssetAllocationChartWrapper({
  displayCurrency,
  netWorth,
}: {
  displayCurrency: string;
  netWorth: number;
}) {
  const assetAllocation = await calculateAssetAllocation(displayCurrency);

  return (
    <AssetAllocationDonut
      currency={displayCurrency}
      netWorth={netWorth}
      assetAllocation={assetAllocation}
    />
  );
}

async function NewsWidgetWrapper() {
  const newsResult = await fetchPortfolioNews(8);
  return <NewsWidget newsData={newsResult} />;
}

// Main page component
export default async function DashboardPage() {
  const { profile } = await fetchProfile();
  const netWorth = await calculateNetWorth(profile.display_currency);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Greetings username={profile.username} />
          <p className="text-muted-foreground">Here&apos;s your summary</p>
        </div>
        <MarketDataDisclaimer />
      </div>
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-6 xl:col-span-4">
          <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
            <NetWorthChartWrapper
              displayCurrency={profile.display_currency}
              netWorth={netWorth}
            />
          </Suspense>
        </div>
        <div className="col-span-6 lg:col-span-3 xl:col-span-2">
          <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
            <AssetAllocationChartWrapper
              displayCurrency={profile.display_currency}
              netWorth={netWorth}
            />
          </Suspense>
        </div>
        <div className="col-span-6 lg:col-span-3">
          <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
            <NewsWidgetWrapper />
          </Suspense>
        </div>
        <div className="col-span-6 lg:col-span-3">
          <ProjectedIncomeWidget />
        </div>
      </div>
    </div>
  );
}
