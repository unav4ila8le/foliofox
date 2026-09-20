import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { AssetsTable } from "@/components/dashboard/positions/asset/table/assets-table";

import { fetchPositions } from "@/server/positions/fetch";
import { fetchProfile } from "@/server/profile/actions";
import {
  fetchPositionTags,
  fetchPositionTagAssignments,
} from "@/server/position-tags/fetch";
import { resolveTodayDateKey } from "@/lib/date/date-utils";
import { calculateUnrealizedProfitLoss } from "@/lib/profit-loss/unrealized";

async function AssetsTableWrapper() {
  "use cache: private";
  const { profile } = await fetchProfile();

  // Resolve holdings day in the viewer's civil timezone (not UTC day).
  const asOfDateKey = resolveTodayDateKey(profile.time_zone);
  const [{ positions, snapshots }, tags, assignments] = await Promise.all([
    fetchPositions({
      positionType: "asset",
      includeSnapshots: true,
      asOfDateKey,
    }),
    fetchPositionTags(),
    fetchPositionTagAssignments(),
  ]);
  const positionsWithProfitLoss = calculateUnrealizedProfitLoss(
    positions,
    snapshots,
  );

  const tagsByPosition = new Map<string, string[]>();
  for (const assignment of assignments) {
    const ids = tagsByPosition.get(assignment.position_id) ?? [];
    ids.push(assignment.tag_id);
    tagsByPosition.set(assignment.position_id, ids);
  }
  return (
    <AssetsTable
      tags={tags}
      data={positionsWithProfitLoss.map((position) => ({
        ...position,
        tagIds: tagsByPosition.get(position.id) ?? [],
      }))}
    />
  );
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
