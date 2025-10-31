"use client";

import { useState } from "react";
import { toast } from "sonner";

import { restorePosition, restorePositions } from "@/server/positions/restore";

interface UseRestorePositionOptions {
  onSuccess?: () => void;
}

export function useRestorePosition(options?: UseRestorePositionOptions) {
  const [isRestoring, setIsRestoring] = useState(false);

  const { onSuccess } = options || {};

  const restoreSingle = async (positionId: string) => {
    setIsRestoring(true);
    try {
      const result = await restorePosition(positionId);
      if (result.success) {
        toast.success("Position restored successfully");
      } else {
        throw new Error(result.message || "Failed to restore position");
      }
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to restore position",
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const restoreMultiple = async (positionIds: string[]) => {
    setIsRestoring(true);
    try {
      const result = await restorePositions(positionIds);
      if (!result.success) {
        throw new Error(result.message || "Failed to restore asset(s)");
      }
      toast.success(`${result.count} asset(s) restored successfully`);
      // Reset selection state
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to restore asset(s)",
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return {
    restorePosition: restoreSingle,
    restorePositions: restoreMultiple,
    isRestoring,
  };
}
