import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { SyntheticEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PositionCategorySelector } from "./position-category-selector";

const mocks = vi.hoisted(() => ({
  refreshCategories: vi.fn(),
  createUserPositionCategory: vi.fn(),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;
window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("@/hooks/use-position-categories", () => ({
  usePositionCategories: () => ({
    categories: [
      {
        id: "equity",
        name: "Equity",
        source: "system",
        category_id: "equity",
        user_category_id: null,
        position_type: "asset",
      },
      {
        id: "custom-1",
        name: "Retirement",
        source: "custom",
        category_id: "other",
        user_category_id: "custom-1",
        position_type: "asset",
      },
    ],
    isLoading: false,
    error: null,
    refreshCategories: mocks.refreshCategories,
  }),
}));

vi.mock("@/server/position-categories/fetch", () => ({
  createUserPositionCategory: mocks.createUserPositionCategory,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("PositionCategorySelector", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.refreshCategories.mockReset();
    mocks.refreshCategories.mockResolvedValue(undefined);
    mocks.createUserPositionCategory.mockReset();
  });

  function openSelector() {
    fireEvent.click(screen.getAllByRole("combobox")[0]);
  }

  it("groups system and custom categories", () => {
    render(
      <PositionCategorySelector
        field={{ value: "equity", onChange: vi.fn() }}
        allowCustomCategories
      />,
    );

    openSelector();

    expect(screen.getByText("System Categories")).toBeTruthy();
    expect(screen.getByText("Custom Categories")).toBeTruthy();
    expect(screen.getAllByText("Equity").length).toBeGreaterThan(0);
    expect(screen.getByText("Retirement")).toBeTruthy();
    expect(screen.getByText("Add new custom category")).toBeTruthy();
  });

  it("selects a custom category as other plus user category id", () => {
    const onChange = vi.fn();
    const onUserCategoryChange = vi.fn();

    render(
      <PositionCategorySelector
        field={{ value: "equity", onChange }}
        userCategoryId={null}
        onUserCategoryChange={onUserCategoryChange}
        allowCustomCategories
      />,
    );

    openSelector();
    fireEvent.click(screen.getByText("Retirement"));

    expect(onChange).toHaveBeenCalledWith("other");
    expect(onUserCategoryChange).toHaveBeenCalledWith("custom-1");
  });

  it("creates and selects a custom category from the modal", async () => {
    const onChange = vi.fn();
    const onUserCategoryChange = vi.fn();
    mocks.createUserPositionCategory.mockResolvedValue({
      success: true,
      created: true,
      category: {
        id: "custom-2",
        name: "Wine Collection",
      },
    });

    render(
      <PositionCategorySelector
        field={{ value: "equity", onChange }}
        userCategoryId={null}
        onUserCategoryChange={onUserCategoryChange}
        allowCustomCategories
      />,
    );

    openSelector();
    fireEvent.click(screen.getByText("Add new custom category"));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Wine Collection" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.createUserPositionCategory).toHaveBeenCalledWith({
        name: "Wine Collection",
        positionType: "asset",
      });
    });
    expect(mocks.refreshCategories).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("other");
    expect(onUserCategoryChange).toHaveBeenCalledWith("custom-2");
  });

  it("does not submit a parent form when creating a custom category", async () => {
    const onParentSubmit = vi.fn((event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    mocks.createUserPositionCategory.mockResolvedValue({
      success: true,
      created: true,
      category: {
        id: "custom-2",
        name: "Wine Collection",
      },
    });

    render(
      <form onSubmit={onParentSubmit}>
        <PositionCategorySelector
          field={{ value: "equity", onChange: vi.fn() }}
          userCategoryId={null}
          onUserCategoryChange={vi.fn()}
          allowCustomCategories
        />
      </form>,
    );

    openSelector();
    fireEvent.click(screen.getByText("Add new custom category"));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Wine Collection" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.createUserPositionCategory).toHaveBeenCalled();
    });
    expect(onParentSubmit).not.toHaveBeenCalled();
  });
});
