import { HoldingsTables } from "@/components/dashboard/assets/holdings-tables";

import { fetchHoldings } from "@/server/holdings/fetch";

import type { Holding } from "@/types/global.types";

async function getHoldings(): Promise<Holding[]> {
  try {
    const holdings = await fetchHoldings();
    return holdings.map((holding) => ({
      ...holding,
      asset_type: holding.asset_categories.name,
      total_value: holding.current_value * holding.current_quantity,
    }));
  } catch (error) {
    console.error("Error fetching holdings:", error);
    return [];
  }
}

export default async function AssetsPage() {
  const holdings = await getHoldings();

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
