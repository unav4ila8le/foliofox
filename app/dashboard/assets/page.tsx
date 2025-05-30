import { HoldingsTables } from "@/components/dashboard/assets/holdings-tables";

import { fetchHoldings } from "@/server/holdings/fetch";

export default async function AssetsPage() {
  const holdings = await fetchHoldings();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Asset Portfolio</h1>
        <p className="text-muted-foreground">
          Here&apos;s a list of all your holdings
        </p>
      </div>
      <HoldingsTables data={holdings} />
    </div>
  );
}
