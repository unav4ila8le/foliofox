import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { AssetsTable } from "@/components/dashboard/positions/asset/table/assets-table";

import { fetchPositions } from "@/server/positions/fetch";
import { fetchProfile } from "@/server/profile/actions";
import { resolveTodayDateKey } from "@/lib/date/date-utils";
import { calculateProfitLoss } from "@/lib/profit-loss";

async function AssetsTableWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();

  // Resolve holdings day in the viewer's civil timezone (not UTC day).
  const asOfDateKey = resolveTodayDateKey(profile.time_zone);
  const { positions, snapshots } = await fetchPositions({
    positionType: "asset",
    includeSnapshots: true,
    asOfDateKey,
  });
  const positionsWithProfitLoss = calculateProfitLoss(positions, snapshots);

  return <AssetsTable data={positionsWithProfitLoss} />;
}

export default function AssetsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio Assets</h1>
        <p className="text-muted-foreground">
          Here&apos;s a list of all your assets in your portfolio
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AssetsTableWrapper />
      </Suspense>
    </div>
  );
}
