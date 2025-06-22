import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { AssetAllocationDonut } from "@/components/dashboard/charts/asset-allocation-donut";
import { NetWorthLineChart } from "@/components/dashboard/charts/net-worth-line";
import { Greetings } from "@/components/dashboard/greetings";

import { fetchProfile } from "@/server/profile/actions";
import { calculateNetWorth } from "@/server/analysis/net-worth";
import { fetchNetWorthHistory } from "@/server/analysis/net-worth-history";
import { fetchNetWorthChange } from "@/server/analysis/net-worth-change";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";

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

// Main page component
export default async function DashboardPage() {
  const { profile } = await fetchProfile();
  const netWorth = await calculateNetWorth(profile.display_currency);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Greetings username={profile.username} />
        <p className="text-muted-foreground">Here&apos;s your summary</p>
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
      </div>
    </div>
  );
}
