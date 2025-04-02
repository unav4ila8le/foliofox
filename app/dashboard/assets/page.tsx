import { Asset, columns } from "@/components/dashboard/assets/table/columns";
import { DataTable } from "@/components/dashboard/assets/table/data-table";

async function getData(): Promise<Asset[]> {
  // Fetch data from your API here.
  return [
    {
      id: "728ed52f",
      asset_name: "WISE Account",
      currency: "USD",
      value: 51056.04,
      quantity: 1,
      total_value: 51056.04,
    },
    {
      id: "728ed53f",
      asset_name: "CSR Account",
      currency: "EUR",
      value: 63991.89,
      quantity: 1,
      total_value: 63991.89,
    },
    {
      id: "728ed54f",
      asset_name: "IBKR Account",
      currency: "EUR",
      value: 1733.2,
      quantity: 1,
      total_value: 1733.2,
    },
    // ...
  ];
}

export default async function Assets() {
  const data = await getData();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Asset Portfolio</h1>
        <p className="text-muted-foreground">
          Here&apos;s a list of all your assets
        </p>
      </div>
      <DataTable columns={columns} data={data} title="Cash" count={2} />
    </div>
  );
}
