import type { Tables } from "@/types/database.types";

export type PositionTag = Tables<"user_position_tags">;
export type PositionTagAssignment = Tables<"position_tag_assignments">;

export interface PositionTagFailure {
  success: false;
  code: string;
  message: string;
  // Refresh saved state before retrying when the write response was inconclusive.
  outcomeUnknown: boolean;
}

export type PositionTagMutationResult =
  { success: true; tag: PositionTag } | PositionTagFailure;

export type PositionTagWriteResult = { success: true } | PositionTagFailure;

export interface PositionTagTargets {
  positionIds: string[];
  tagIds: string[];
}

export type PositionSaveStep = "details" | "tag_add" | "tag_remove";

export type UpdatePositionResult =
  | { success: true }
  | (PositionTagFailure & {
      failedStep: "validation" | PositionSaveStep;
      savedSteps: PositionSaveStep[];
    });
