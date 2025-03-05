import { CurrencySelector } from "@/components/dashboard/currency-selector";
import { getTimeBasedGreeting } from "@/lib/date";
import { NetWorthLineChart } from "@/components/dashboard/charts/net-worth-line-chart";
import { AssetAllocationChart } from "@/components/dashboard/charts/asset-allocation-chart";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {getTimeBasedGreeting()}, John
          </h1>
          <p className="text-muted-foreground">Here&apos;s your summary</p>
        </div>
        <CurrencySelector />
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
