import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import {
  PositionTagsProvider,
  usePositionTags,
  type TagData,
} from "./provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TagCell } from "./tag-cell";
import { ManageTagsDialog } from "./manage-tags-dialog";
import { UpdateAssetForm } from "@/components/dashboard/positions/asset/update/form";
import { UpdateAssetDialog } from "@/components/dashboard/positions/asset/update";
import { AssetsTable } from "@/components/dashboard/positions/asset/table/assets-table";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import type { AssetTableRow } from "@/components/dashboard/positions/asset/table/types";
import type { Position } from "@/types/global.types";

const mocks = vi.hoisted(() => ({
  router: { refresh: vi.fn(), push: vi.fn() },
  fetchTags: vi.fn(),
  fetchAssignments: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  updatePosition: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/hooks/use-locale", () => ({ useLocale: () => "en-US" }));
vi.mock("@/server/position-tags/fetch", () => ({
  fetchPositionTags: mocks.fetchTags,
  fetchPositionTagAssignments: mocks.fetchAssignments,
}));
vi.mock("@/server/position-tags/actions", () => ({
  addPositionTags: mocks.add,
  removePositionTags: mocks.remove,
  createPositionTag: mocks.create,
  updatePositionTag: mocks.updateTag,
  deletePositionTag: mocks.deleteTag,
}));
vi.mock("@/server/positions/update", () => ({
  updatePosition: mocks.updatePosition,
}));
vi.mock("@/components/dashboard/categories/position-category-selector", () => ({
  PositionCategorySelector: () => <span>Category selector</span>,
}));
vi.mock(
  "@/components/dashboard/positions/shared/capital-gains-tax-rate-field",
  () => ({ CapitalGainsTaxRateField: () => null }),
);
vi.mock("@/components/dashboard/positions/shared/update-symbol-dialog", () => ({
  UpdateSymbolDialog: () => null,
}));
vi.mock("@/components/dashboard/new-asset", () => ({
  NewAssetButton: () => <button>Add asset</button>,
}));
vi.mock("@/components/dashboard/positions/asset/table/table-actions", () => ({
  TableActionsDropdown: ({
    positionsCount,
    onManageTags,
  }: {
    positionsCount: number;
    onManageTags: () => void;
  }) => (
    <div aria-label="Table actions">
      <button>Export {positionsCount} assets</button>
      <button onClick={onManageTags}>Manage tags</button>
    </div>
  ),
}));
vi.mock(
  "@/components/dashboard/positions/asset/table/row-actions/actions-cell",
  () => ({
    ActionsCell: ({ onEdit }: { onEdit: () => void }) => (
      <button
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        Edit details
      </button>
    ),
  }),
);
vi.mock("@/components/dashboard/positions/asset/stale-badge", () => ({
  StaleBadge: () => null,
}));
vi.mock("@/components/dashboard/tables/base/bulk-action-bar", () => ({
  BulkActionBar: ({
    selectedCount,
    actions,
  }: {
    selectedCount: number;
    actions: { label: string; onClick: () => void }[];
  }) => (
    <div aria-label="Bulk actions">
      {selectedCount} selected
      {actions.map((action) => (
        <button key={action.label} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("@/components/dashboard/positions/shared/delete-dialog", () => ({
  DeletePositionDialog: () => null,
}));
vi.mock("@/components/dashboard/positions/shared/archive-dialog", () => ({
  ArchivePositionDialog: () => null,
}));

const tag = (id: string, name: string) => ({
  id,
  name,
  color: "blue",
  user_id: "user",
  created_at: "",
  updated_at: "",
});
const dad = tag("dad", "Dad");
const retirement = tag("retirement", "Retirement");
const technology = tag("technology", "Technology");
const initial: TagData = {
  tags: [dad, retirement, technology],
  assignments: [],
};
const position = {
  id: "asset",
  name: "Savings account",
  type: "asset",
  category_id: "other",
  user_category_id: null,
  capital_gains_tax_rate: null,
  description: null,
} as Position;
let saved: TagData;

beforeEach(() => {
  vi.clearAllMocks();
  saved = { tags: [...initial.tags], assignments: [] };
  mocks.fetchTags.mockImplementation(async () => saved.tags);
  mocks.fetchAssignments.mockImplementation(async () => saved.assignments);
  mocks.updatePosition.mockResolvedValue({ success: true });
  mocks.add.mockResolvedValue({ success: true });
  mocks.remove.mockResolvedValue({ success: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

function editor(onSuccess = vi.fn()) {
  return render(
    <PositionTagsProvider initialData={initial}>
      <UpdateAssetForm position={position} onSuccess={onSuccess} />
    </PositionTagsProvider>,
  );
}
async function choose(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Choose tags" }));
  fireEvent.click(await screen.findByRole("checkbox", { name }));
  fireEvent.keyDown(screen.getByRole("checkbox", { name }), { key: "Escape" });
}

describe("draft tag editing", () => {
  it("enables tag-only saves and sends assignments only on Save changes", async () => {
    editor();
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .hasAttribute("disabled"),
    ).toBe(true);
    await choose("Dad");
    expect(mocks.updatePosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.updatePosition).toHaveBeenCalledTimes(1));
    expect(mocks.updatePosition.mock.calls[0][0].get("tag_ids")).toBe(
      '["dad"]',
    );
  });

  it("omits unchanged assignments for details-only edits", async () => {
    editor();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Updated Savings" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.updatePosition).toHaveBeenCalledTimes(1));
    expect(mocks.updatePosition.mock.calls[0][0].has("tag_ids")).toBe(false);
  });

  it("cancels assignment drafts without writing", async () => {
    const close = vi.fn();
    editor(close);
    await choose("Dad");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalled();
    expect(mocks.updatePosition).not.toHaveBeenCalled();
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it("keeps requested tags and the editor open after a partial failure, then retries", async () => {
    const close = vi.fn();
    editor(close);
    mocks.updatePosition.mockResolvedValueOnce({
      success: false,
      code: "42501",
      message: "Details were saved. Tag changes failed.",
      savedSteps: ["details"],
      failedStep: "tag_add",
      outcomeUnknown: false,
    });
    await choose("Dad");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const retry = await screen.findByRole("button", { name: "Retry" });
    await waitFor(() => expect(retry.hasAttribute("disabled")).toBe(false));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "Details were saved",
    );
    fireEvent.click(retry);
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(mocks.updatePosition.mock.calls[1][0].get("tag_ids")).toBe(
      '["dad"]',
    );
  });

  it("refreshes after a lost response and again before retrying", async () => {
    editor();
    mocks.updatePosition.mockRejectedValueOnce(new Error("lost response"));
    await choose("Dad");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const retry = await screen.findByRole("button", {
      name: "Refresh and retry",
    });
    await waitFor(() => expect(retry.hasAttribute("disabled")).toBe(false));
    expect(mocks.fetchAssignments).toHaveBeenCalled();
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.updatePosition).toHaveBeenCalledTimes(2));
    expect(mocks.fetchAssignments.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.updatePosition.mock.invocationCallOrder[1],
    );
  });

  it("adopts a tag whose create response was lost instead of inserting it twice", async () => {
    const created = tag("new", "Holiday");
    mocks.create.mockImplementationOnce(async () => {
      saved = { ...saved, tags: [...saved.tags, created] };
      throw new Error("lost response");
    });
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Choose tags" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search tags" }), {
      target: { value: " holiday " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create “holiday”" }));
    const dialog = await screen.findByRole("dialog", { name: "Create tag" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create tag" }));
    const retry = await within(dialog).findByRole("button", {
      name: "Refresh and retry",
    });
    await waitFor(() => expect(retry.hasAttribute("disabled")).toBe(false));
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Create tag" })).toBeNull(),
    );
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("creates a reusable definition immediately but keeps its assignment as a draft", async () => {
    const created = tag("new", "Holiday");
    mocks.create.mockImplementation(async () => {
      saved = { ...saved, tags: [...saved.tags, created] };
      return { success: true, tag: created };
    });
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Choose tags" }));
    expect(screen.queryByRole("button", { name: /^Create/ })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Search tags" }), {
      target: { value: "Holiday" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create “Holiday”" }));
    const dialog = await screen.findByRole("dialog", { name: "Create tag" });
    expect(
      (
        within(dialog).getByRole("textbox", {
          name: "Name",
        }) as HTMLInputElement
      ).value,
    ).toBe("Holiday");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create tag" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Create tag" })).toBeNull(),
    );
    expect(mocks.create).toHaveBeenCalledWith({
      name: "Holiday",
      color: "blue",
    });
    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.updatePosition).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("loads private tags only when the standalone asset editor opens", async () => {
    const { rerender } = render(
      <UpdateAssetDialog
        position={position}
        open={false}
        onOpenChangeAction={vi.fn()}
      />,
    );
    expect(mocks.fetchTags).not.toHaveBeenCalled();
    rerender(
      <UpdateAssetDialog
        position={position}
        open
        onOpenChangeAction={vi.fn()}
      />,
    );
    await screen.findByRole("button", { name: "Choose tags" });
    expect(mocks.fetchAssignments).toHaveBeenCalledWith("asset");
  });
});

describe("immediate tagging", () => {
  it("does not navigate or optimistically check a pending assignment", async () => {
    let finish!: (result: { success: true }) => void;
    mocks.add.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const navigate = vi.fn();
    function Cell() {
      // Read the actual shared data rather than a row-local optimistic copy.
      const state = usePositionTags()!;
      const ids = state.data!.assignments.map(
        (assignment) => assignment.tag_id,
      );
      return (
        <div onClick={navigate}>
          <TagCell positionId="asset" name="Savings" tagIds={ids} />
        </div>
      );
    }
    render(
      <PositionTagsProvider initialData={initial}>
        <Cell />
      </PositionTagsProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
    const checkbox = await screen.findByRole("checkbox", { name: "Dad" });
    fireEvent.click(checkbox);
    expect(navigate).not.toHaveBeenCalled();
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    expect(checkbox.hasAttribute("disabled")).toBe(true);
    saved.assignments = [{ position_id: "asset", tag_id: "dad" }];
    await act(async () => {
      finish({ success: true });
    });
    expect(mocks.fetchAssignments).toHaveBeenCalled();
    expect(
      screen
        .getByRole("checkbox", { name: "Dad" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("keeps refreshed data when the server re-renders with a stale payload", async () => {
    function Probe() {
      const state = usePositionTags()!;
      return (
        <button onClick={() => void state.refresh()}>
          {state.data!.assignments.map((a) => a.tag_id).join(",") || "none"}
        </button>
      );
    }
    const { rerender } = render(
      <PositionTagsProvider initialData={initial}>
        <Probe />
      </PositionTagsProvider>,
    );
    saved.assignments = [{ position_id: "asset", tag_id: "dad" }];
    fireEvent.click(screen.getByRole("button", { name: "none" }));
    await screen.findByRole("button", { name: "dad" });
    // A revalidated route can deliver a private-cache payload older than the write.
    rerender(
      <PositionTagsProvider initialData={{ ...initial, assignments: [] }}>
        <Probe />
      </PositionTagsProvider>,
    );
    expect(screen.getByRole("button").textContent).toBe("dad");
  });

  it("settles an in-flight refresh when the server re-seeds initialData", async () => {
    let finish!: (tags: typeof initial.tags) => void;
    mocks.fetchTags.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    function Probe() {
      const state = usePositionTags()!;
      return (
        <button
          disabled={state.isRefreshing}
          onClick={() => void state.refresh()}
        >
          {state.data!.tags.length}
        </button>
      );
    }
    const { rerender } = render(
      <PositionTagsProvider initialData={initial}>
        <Probe />
      </PositionTagsProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    // revalidatePath re-renders the RSC parent with a fresh initialData object.
    rerender(
      <PositionTagsProvider initialData={{ ...initial }}>
        <Probe />
      </PositionTagsProvider>,
    );
    await act(async () => {
      finish([...initial.tags, tag("new", "Holiday")]);
    });
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button").textContent).toBe("4");
  });

  it("confirms deletion and refreshes the shared definitions", async () => {
    mocks.deleteTag.mockImplementation(async () => {
      saved = {
        ...saved,
        tags: saved.tags.filter((value) => value.id !== "dad"),
      };
      return { success: true };
    });
    render(
      <PositionTagsProvider initialData={initial}>
        <ManageTagsDialog onClose={vi.fn()} />
      </PositionTagsProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Dad" }));
    expect(mocks.deleteTag).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete tag",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete Dad" })).toBeNull(),
    );
    expect(mocks.deleteTag).toHaveBeenCalledWith("dad");
  });
});

const tableColumns: ColumnDef<{ id: string; name: string }>[] = [
  {
    id: "select",
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label={`Select ${row.original.name}`}
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <button onClick={() => column.toggleSorting()}>Sort name</button>
    ),
  },
];

describe("table selection reset", () => {
  it("clears actual checkboxes and shift anchors without losing sorting", () => {
    const data = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
      { id: "c", name: "Charlie" },
    ];
    const { rerender } = render(
      <DataTable columns={tableColumns} data={data} selectionResetKey={0} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sort name" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort name" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Charlie" }));
    rerender(
      <DataTable columns={tableColumns} data={data} selectionResetKey={1} />,
    );
    expect(
      screen
        .getAllByRole("checkbox")
        .every((node) => !(node as HTMLInputElement).checked),
    ).toBe(true);
    expect(screen.getAllByRole("row")[1].textContent).toContain("Charlie");
    fireEvent.keyDown(window, { key: "Shift" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Select Beta",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
    fireEvent.keyUp(window, { key: "Shift" });
  });

  it("emits current selected row objects when data changes", () => {
    const changed = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={tableColumns}
        data={[{ id: "a", name: "Alpha" }]}
        onSelectedRowsChange={changed}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    rerender(
      <DataTable
        columns={tableColumns}
        data={[{ id: "a", name: "Updated" }]}
        onSelectedRowsChange={changed}
      />,
    );
    expect(changed).toHaveBeenLastCalledWith([{ id: "a", name: "Updated" }]);
  });
});

const assetRows = [
  { ...position, id: "a", name: "Alpha", tagIds: ["dad", "retirement"] },
  { ...position, id: "b", name: "Beta", tagIds: ["dad"] },
  { ...position, id: "c", name: "Charlie", tagIds: ["retirement"] },
].map((row) => ({
  ...row,
  currency: "USD",
  display_category_id: "other",
  display_category_name: "Others",
  total_value: 10,
  current_quantity: 1,
  current_unit_value: 10,
  has_market_data: false,
})) as AssetTableRow[];

describe("private asset filtering", () => {
  it("bulk edits only the current visible selection and clears checkboxes on completion", async () => {
    render(
      <TooltipProvider>
        <AssetsTable data={assetRows} tags={initial.tags} />
      </TooltipProvider>,
    );
    fireEvent.click(
      within(screen.getByText("Beta").closest("tr")!).getByRole("checkbox"),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Search assets" }), {
      target: { value: "ALPHA" },
    });
    expect(screen.queryByLabelText("Bulk actions")).toBeNull();
    fireEvent.click(
      within(screen.getByText("Alpha").closest("tr")!).getByRole("checkbox"),
    );
    fireEvent.click(
      within(screen.getByLabelText("Bulk actions")).getByRole("button", {
        name: "Add tags",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Add tags" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Choose tags" }),
    );
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Technology" }),
    );
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "Technology" }), {
      key: "Escape",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add tags" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add tags" })).toBeNull(),
    );
    expect(mocks.add).toHaveBeenCalledWith({
      positionIds: ["a"],
      tagIds: ["technology"],
    });
    expect(screen.queryByLabelText("Bulk actions")).toBeNull();
    expect(
      within(screen.getByText("Alpha").closest("tr")!)
        .getByRole("checkbox")
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("keeps a failed editor open when refreshed tags hide its row", async () => {
    saved.assignments = assetRows.flatMap((row) =>
      row.tagIds.map((tag_id) => ({ position_id: row.id, tag_id })),
    );
    mocks.updatePosition.mockImplementationOnce(async () => {
      saved.assignments = saved.assignments.filter(
        (value) => !(value.position_id === "a" && value.tag_id === "dad"),
      );
      return {
        success: false,
        code: "REQUEST_FAILED",
        message: "Outcome unknown.",
        savedSteps: ["details"],
        failedStep: "tag_remove",
        outcomeUnknown: true,
      };
    });
    render(
      <TooltipProvider>
        <AssetsTable data={assetRows} tags={initial.tags} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tags" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Dad" }));
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "Dad" }), {
      key: "Escape",
    });
    fireEvent.click(
      within(screen.getByText("Alpha").closest("tr")!).getByRole("button", {
        name: "Edit details",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit details" });
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Choose tags" }),
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: "Dad" }));
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "Dad" }), {
      key: "Escape",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await screen.findByRole("button", { name: "Refresh and retry" });
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
    expect(screen.getByRole("dialog", { name: "Edit details" })).toBeDefined();
    expect(
      within(dialog).getByRole("button", { name: "Choose tags" }).textContent,
    ).toContain("Retirement");
  });

  it("removes a deleted tag from active filters", async () => {
    mocks.deleteTag.mockImplementation(async () => {
      saved.tags = saved.tags.filter((value) => value.id !== "dad");
      return { success: true };
    });
    render(
      <TooltipProvider>
        <AssetsTable data={assetRows} tags={initial.tags} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tags" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Dad" }));
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "Dad" }), {
      key: "Escape",
    });
    expect(screen.getByText("2 of 3 assets")).toBeDefined();
    fireEvent.click(
      within(screen.getByLabelText("Table actions")).getByRole("button", {
        name: "Manage tags",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Dad" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete tag",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete Dad" })).toBeNull(),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(screen.getByText("3 of 3 assets")).toBeDefined();
  });

  it("matches all tags plus name and clears hidden checkbox selections while exporting all assets", async () => {
    render(
      <TooltipProvider>
        <AssetsTable data={assetRows} tags={initial.tags} />
      </TooltipProvider>,
    );
    const alpha = screen.getByText("Alpha").closest("tr")!;
    fireEvent.click(within(alpha).getByRole("checkbox"));
    expect(screen.getByLabelText("Bulk actions")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Tags" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Dad" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Retirement" }));
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "Dad" }), {
      key: "Escape",
    });
    expect(screen.queryByText("Beta")).toBeNull();
    expect(screen.queryByText("Charlie")).toBeNull();
    expect(screen.getByText("1 of 3 assets")).toBeDefined();
    expect(screen.queryByLabelText("Bulk actions")).toBeNull();
    expect(
      within(screen.getByText("Alpha").closest("tr")!)
        .getByRole("checkbox")
        .getAttribute("aria-checked"),
    ).toBe("false");
    expect(
      screen.getByRole("button", { name: "Export 3 assets" }),
    ).toBeDefined();
    fireEvent.change(screen.getByRole("textbox", { name: "Search assets" }), {
      target: { value: "beta" },
    });
    expect(screen.getByText("0 of 3 assets")).toBeDefined();
    fireEvent.change(screen.getByRole("textbox", { name: "Search assets" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tags" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Dad" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Retirement" }));
    expect(screen.getByText("3 of 3 assets")).toBeDefined();
  });
});
