import { Suspense } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";
import { ArchivedAssetsTable } from "@/components/dashboard/positions/asset/archived/archived-table";

import { fetchPositions } from "@/server/positions/fetch";
import {
  fetchPositionTags,
  fetchPositionTagAssignments,
} from "@/server/position-tags/fetch";

// Separate components for data fetching with suspense
async function ArchivedTableWrapper() {
  "use cache: private";
  const [positions, tags, assignments] = await Promise.all([
    fetchPositions({
      onlyArchived: true,
      positionType: "asset",
    }),
    fetchPositionTags(),
    fetchPositionTagAssignments(),
  ]);
  const tagsByPosition = new Map<string, string[]>();
  for (const assignment of assignments) {
    const ids = tagsByPosition.get(assignment.position_id) ?? [];
    ids.push(assignment.tag_id);
    tagsByPosition.set(assignment.position_id, ids);
  }
  return (
    <ArchivedAssetsTable
      tags={tags}
      data={positions.map((position) => ({
        ...position,
        tagIds: tagsByPosition.get(position.id) ?? [],
      }))}
    />
  );
}

export default function ArchivedAssetsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <ArchivedTableWrapper />
    </Suspense>
  );
}
