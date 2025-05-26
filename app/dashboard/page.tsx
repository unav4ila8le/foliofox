import { NetWorthLineChart } from "@/components/dashboard/charts/net-worth-line";
import { AssetAllocationDonut } from "@/components/dashboard/charts/asset-allocation-donut";

import { fetchProfile } from "@/server/profile/actions";

import { Greetings } from "@/components/dashboard/greetings";
import { calculateNetWorth } from "@/server/analysis/net-worth";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";

export default async function DashboardPage() {
  const { profile } = await fetchProfile();
  const netWorth = await calculateNetWorth(profile.display_currency);
  const assetAllocation = await calculateAssetAllocation(
    profile.display_currency,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Greetings username={profile.username} />
        <p className="text-muted-foreground">Here&apos;s your summary</p>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-6 xl:col-span-4">
          <NetWorthLineChart />
        </div>
        <div className="col-span-6 lg:col-span-3 xl:col-span-2">
          <AssetAllocationDonut
            netWorth={netWorth}
            currency={profile.display_currency}
            assetAllocation={assetAllocation}
          />
        </div>
      </div>
    </div>
  );
}
