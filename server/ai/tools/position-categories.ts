"use server";

import { fetchPositionCategories } from "@/server/position-categories/fetch";

interface GetPositionCategoriesParams {
  positionType: "asset" | "liability" | null;
}

/**
 * List valid position categories (system + the user's custom ones) so the
 * assistant can pick a real category id before creating a position.
 */
export async function getPositionCategories(
  params: GetPositionCategoriesParams,
) {
  const categories = await fetchPositionCategories({
    positionType: params.positionType ?? "asset",
    includeCustomCategories: true,
  });

  return { categories };
}
