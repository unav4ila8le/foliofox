import { AssetAllocationDonut } from "@/components/dashboard/charts/asset-allocation-donut";
import { NetWorthLineChartRecharts } from "@/components/dashboard/charts/net-worth-line-recharts";
import { Greetings } from "@/components/dashboard/greetings";

import { fetchProfile } from "@/server/profile/actions";
import { calculateNetWorth } from "@/server/analysis/net-worth";
import { fetchNetWorthHistory } from "@/server/analysis/net-worth-history";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";

export default async function DashboardPage() {
  const { profile } = await fetchProfile();
  const netWorth = await calculateNetWorth(profile.display_currency);
  const assetAllocation = await calculateAssetAllocation(
    profile.display_currency,
  );
  const netWorthHistory = await fetchNetWorthHistory({
    targetCurrency: profile.display_currency,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Greetings username={profile.username} />
        <p className="text-muted-foreground">Here&apos;s your summary</p>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-6 xl:col-span-4">
          <NetWorthLineChartRecharts
            currency={profile.display_currency}
            netWorth={netWorth}
            history={netWorthHistory}
          />
        </div>
        <div className="col-span-6 lg:col-span-3 xl:col-span-2">
          <AssetAllocationDonut
            currency={profile.display_currency}
            netWorth={netWorth}
            assetAllocation={assetAllocation}
          />
        </div>
      </div>
    </div>
  );
}
