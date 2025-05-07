import { Asset } from "@/components/dashboard/assets/table/columns";
import { AssetsTables } from "@/components/dashboard/assets/assets-tables";

import { fetchHoldings } from "@/server/holdings/actions";

async function getData(): Promise<Asset[]> {
  try {
    const holdings = await fetchHoldings();

    // Transform holdings data to match Asset type
    return holdings.map((holding) => ({
      id: holding.id,
      asset_name: holding.name,
      asset_type: holding.asset_categories.name,
      currency: holding.currency,
      quantity: holding.quantity,
      value: holding.current_value,
      total_value: holding.current_value * holding.quantity,
    }));
  } catch (error) {
    console.error("Error fetching holdings:", error);
    return []; // Return empty array in case of error
  }
}

export default async function AssetsPage() {
  const data = await getData();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Asset Portfolio</h1>
        <p className="text-muted-foreground">
          Here&apos;s a list of all your assets
        </p>
      </div>
      <AssetsTables data={data} />
    </div>
  );
}
