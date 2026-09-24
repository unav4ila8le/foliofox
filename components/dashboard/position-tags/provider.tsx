"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AI_WRITE_COMMITTED_EVENT } from "@/lib/ai/write-tools";
import {
  fetchPositionTags,
  fetchPositionTagAssignments,
} from "@/server/position-tags/fetch";
import type {
  PositionTag,
  PositionTagAssignment,
} from "@/server/position-tags/types";

export interface TagData {
  tags: PositionTag[];
  assignments: PositionTagAssignment[];
}
interface TagContextValue {
  data: TagData | undefined;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<TagData>;
}
const TagContext = createContext<TagContextValue | null>(null);
export const usePositionTags = () => useContext(TagContext);

export function PositionTagsProvider({
  initialData,
  positionId,
  children,
}: {
  initialData?: TagData;
  positionId?: string;
  children: React.ReactNode;
}) {
  // initialData only seeds state. After mount, refresh() is the sole writer:
  // server re-renders can hand down a stale private-cache payload after a write.
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const read = useCallback(async () => {
    const [tags, assignments] = await Promise.all([
      fetchPositionTags(),
      fetchPositionTagAssignments(positionId),
    ]);
    return { tags, assignments };
  }, [positionId]);
  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    setIsRefreshing(true);
    try {
      const next = await read();
      if (request === requestId.current) {
        setData(next);
        setError(null);
      }
      return next;
    } catch {
      if (request === requestId.current)
        setError(
          "Could not refresh tags. Refresh before making more tag changes.",
        );
      throw new Error("Could not refresh saved tags.");
    } finally {
      if (request === requestId.current) setIsRefreshing(false);
    }
  }, [read]);
  useEffect(() => {
    // A re-seeded initialData must not invalidate an in-flight refresh().
    if (initialData) return;
    const request = ++requestId.current;
    let cancelled = false;
    void read()
      .then((next) => {
        if (!cancelled && request === requestId.current) {
          setData(next);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled && request === requestId.current)
          setError("Could not load tags. Try refreshing tags.");
      })
      .finally(() => {
        if (!cancelled && request === requestId.current) setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialData, read]);
  useEffect(() => {
    // Advisor tag writes happen outside this provider; re-read after each one.
    const onAIWrite = () => void refresh().catch(() => {});
    window.addEventListener(AI_WRITE_COMMITTED_EVENT, onAIWrite);
    return () =>
      window.removeEventListener(AI_WRITE_COMMITTED_EVENT, onAIWrite);
  }, [refresh]);
  return (
    <TagContext.Provider value={{ data, isRefreshing, error, refresh }}>
      {children}
    </TagContext.Provider>
  );
}

export function TagDataStatus() {
  const state = usePositionTags();
  if (!state) return null;
  if (state.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {state.error}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={state.isRefreshing}
            onClick={() => void state.refresh().catch(() => {})}
          >
            Refresh tags
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!state.data)
    return (
      <p
        role="status"
        className="text-muted-foreground flex items-center gap-2 text-sm"
      >
        <Spinner />
        Loading tags…
      </p>
    );
  return null;
}
