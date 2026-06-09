import type { UserPositionCategory } from "@/types/global.types";

export type PositionType = "asset" | "liability";

// Normalized category row used by selectors and imports. System and custom
// categories share one shape so the UI can persist selections without branching
// on database table names.
export type PositionCategoryListItem = {
  id: string;
  name: string;
  source: "system" | "custom";
  category_id: string;
  user_category_id: string | null;
  position_type: PositionType;
};

export type UserPositionCategoryListItem = {
  id: string;
  name: string;
  position_type: PositionType;
  position_count: number;
};

export type UserPositionCategoryMutationResult =
  | {
      success: true;
      category: UserPositionCategory;
    }
  | {
      success: false;
      code: string;
      message: string;
    };

export type UserPositionCategoryCreateResult =
  | (UserPositionCategoryMutationResult & { success: true; created: boolean })
  | Extract<UserPositionCategoryMutationResult, { success: false }>;

export type UserPositionCategoryDeleteResult =
  | { success: true }
  | { success: false; code: string; message: string };
