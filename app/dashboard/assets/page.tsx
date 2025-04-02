import { Payment, columns } from "@/components/dashboard/assets/table/columns";
import { DataTable } from "@/components/dashboard/assets/table/data-table";

async function getData(): Promise<Payment[]> {
  // Fetch data from your API here.
  return [
    {
      id: "728ed52f",
      amount: 100,
      status: "pending",
      email: "m@example.com",
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
      <DataTable columns={columns} data={data} />
    </div>
  );
}
