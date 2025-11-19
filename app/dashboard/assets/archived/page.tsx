import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { ArchivedAssetsTable } from "@/components/dashboard/positions/asset/archived/archived-table";

import { fetchPositions } from "@/server/positions/fetch";

// Separate components for data fetching with suspense
async function ArchivedTableWrapper() {
  const positions = await fetchPositions({
    onlyArchived: true,
    positionType: "asset",
  });
  return <ArchivedAssetsTable data={positions} />;
}

export default function ArchivedAssetsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <ArchivedTableWrapper />
    </Suspense>
  );
}
