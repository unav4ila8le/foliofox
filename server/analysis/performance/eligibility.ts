"use server";

import { cache } from "react";

import { getCurrentUser } from "@/server/auth/actions";

import type { PerformanceEligibilityData } from "@/server/analysis/performance/types";

export const fetchPerformanceEligibility = cache(
  async (): Promise<PerformanceEligibilityData> => {
    const { supabase, user } = await getCurrentUser();

    const { data: positions, error: positionsError } = await supabase
      .from("positions")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "asset")
      .not("symbol_id", "is", null);

    if (positionsError) {
      throw new Error(positionsError.message);
    }

    if (!positions?.length) {
      return {
        isEligible: false,
        unavailableReason: "no_eligible_positions",
        message: "Performance is available only for symbol-backed investments.",
      };
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("position_snapshots")
      .select("id")
      .eq("user_id", user.id)
      .in(
        "position_id",
        positions.map((position) => position.id),
      )
      .limit(1);

    if (snapshotsError) {
      throw new Error(snapshotsError.message);
    }

    if (!snapshots?.length) {
      return {
        isEligible: false,
        unavailableReason: "insufficient_history",
        message:
          "Add some history to your symbol-backed investments to unlock performance.",
      };
    }

    return {
      isEligible: true,
      unavailableReason: null,
      message: null,
    };
  },
);
