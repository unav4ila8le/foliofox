import { NetWorthLineChart } from "@/components/dashboard/charts/net-worth-line-chart";
import { AssetAllocationChart } from "@/components/dashboard/charts/asset-allocation-chart";

import { fetchProfile } from "@/server/profile/actions";

import { getTimeBasedGreeting } from "@/lib/date";

export default async function DashboardPage() {
  const { profile } = await fetchProfile();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {getTimeBasedGreeting()}, {profile.username}
        </h1>
        <p className="text-muted-foreground">Here&apos;s your summary</p>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-6 xl:col-span-4">
          <NetWorthLineChart />
        </div>
        <div className="col-span-6 lg:col-span-3 xl:col-span-2">
          <AssetAllocationChart />
        </div>
      </div>
    </div>
  );
}
