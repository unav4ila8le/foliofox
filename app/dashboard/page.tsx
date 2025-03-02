import { CurrencySelector } from "@/components/dashboard/currency-selector";
import { getTimeBasedGreeting } from "@/lib/date";
import { NetWorthLineChart } from "@/components/dashboard/charts/net-worth-line-chart";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {getTimeBasedGreeting()}, John
          </h1>
          <p className="text-muted-foreground">Here&apos;s your summary</p>
        </div>
        <CurrencySelector />
      </div>
      <NetWorthLineChart />
    </div>
  );
}
