export interface PositionCategorySelection {
  category_id: string;
  user_category_id: string | null;
}

export function resolvePositionCategorySelection(
  formData: FormData,
): PositionCategorySelection {
  const userCategoryId =
    ((formData.get("user_category_id") as string | null) || "").trim() || null;

  return {
    category_id: userCategoryId
      ? "other"
      : (formData.get("category_id") as string | null) || "other",
    user_category_id: userCategoryId,
  };
}
