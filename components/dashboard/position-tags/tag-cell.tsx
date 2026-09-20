"use client";

import { useState } from "react";
import { TagPicker } from "./tag-picker";
import { usePositionTags } from "./provider";
import {
  addPositionTags,
  removePositionTags,
} from "@/server/position-tags/actions";

export function TagCell({
  positionId,
  name,
  tagIds,
}: {
  positionId: string;
  name: string;
  tagIds: string[];
}) {
  const state = usePositionTags()!;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change(ids: string[]) {
    setPending(true);
    setError(null);
    let saved = false;
    try {
      const adding = ids.filter((id) => !tagIds.includes(id));
      const removing = tagIds.filter((id) => !ids.includes(id));
      const action = adding.length ? addPositionTags : removePositionTags;
      const result = await action({
        positionIds: [positionId],
        tagIds: adding.length ? adding : removing,
      });
      if (!result.success) {
        setError(result.message);
        if (result.outcomeUnknown) await state.refresh();
        return;
      }
      saved = true;
      await state.refresh();
    } catch {
      setError(
        saved
          ? "Tags saved. Refresh tags to see the changes."
          : "The save outcome is unknown. Refresh tags before retrying.",
      );
      await state.refresh().catch(() => {});
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="max-w-80" onClick={(event) => event.stopPropagation()}>
      <TagPicker
        selectedIds={tagIds}
        onChange={change}
        label={tagIds.length ? `Edit tags for ${name}` : "Add tags"}
        pending={pending}
        compact
        quietWhenEmpty
      />
      {error && (
        <p
          role="alert"
          className="text-destructive max-w-64 text-xs whitespace-normal"
        >
          {error}
        </p>
      )}
    </div>
  );
}
