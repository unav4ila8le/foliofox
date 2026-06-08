import { describe, expect, it } from "vitest";

import { resolvePositionCategorySelection } from "./category-selection";

describe("resolvePositionCategorySelection", () => {
  it("uses the selected system category when no custom category is provided", () => {
    const formData = new FormData();
    formData.append("category_id", "equity");

    expect(resolvePositionCategorySelection(formData)).toEqual({
      category_id: "equity",
      user_category_id: null,
    });
  });

  it("forces the system category to other when a custom category is provided", () => {
    const formData = new FormData();
    formData.append("category_id", "equity");
    formData.append("user_category_id", "custom-category-id");

    expect(resolvePositionCategorySelection(formData)).toEqual({
      category_id: "other",
      user_category_id: "custom-category-id",
    });
  });

  it("defaults to other when no category is provided", () => {
    const formData = new FormData();

    expect(resolvePositionCategorySelection(formData)).toEqual({
      category_id: "other",
      user_category_id: null,
    });
  });
});
