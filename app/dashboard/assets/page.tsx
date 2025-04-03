import { Asset, columns } from "@/components/dashboard/assets/table/columns";
import { DataTable } from "@/components/dashboard/assets/table/data-table";

async function getData(): Promise<Asset[]> {
  // Fetch data from your API here.
  return [
    {
      id: "728ed52f",
      asset_name: "WISE Account",
      asset_type: "Cash",
      currency: "USD",
      value: 51056.04,
      quantity: 1,
      total_value: 51056.04,
    },
    {
      id: "728ed53f",
      asset_name: "CSR Account",
      asset_type: "Cash",
      currency: "EUR",
      value: 63991.89,
      quantity: 1,
      total_value: 63991.89,
    },
    {
      id: "728ed54f",
      asset_name: "IBKR Account",
      asset_type: "Stocks",
      currency: "EUR",
      value: 1733.2,
      quantity: 1,
      total_value: 1733.2,
    },
    {
      id: "728ed55f",
      asset_name: "Bitcoin",
      asset_type: "Crypto",
      currency: "USD",
      value: 45000,
      quantity: 0.5,
      total_value: 22500,
    },
    // ...
  ];
}

export default async function Assets() {
  const data = await getData();

  // Group assets by type
  const groupedAssets = data.reduce(
    (acc, asset) => {
      const { asset_type } = asset;
      if (!acc[asset_type]) {
        acc[asset_type] = [];
      }
      acc[asset_type].push(asset);
      return acc;
    },
    {} as Record<string, Asset[]>,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Asset Portfolio</h1>
        <p className="text-muted-foreground">
          Here&apos;s a list of all your assets
        </p>
      </div>
      {Object.entries(groupedAssets).map(([assetType, assets]) => (
        <DataTable
          key={assetType}
          columns={columns}
          data={assets}
          title={assetType}
          count={assets.length}
        />
      ))}
    </div>
  );
}
