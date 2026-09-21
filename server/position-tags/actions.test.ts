import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chunkArray } from "@/server/shared/chunk-array";
import type { Database } from "@/types/database.types";
import { updatePosition } from "@/server/positions/update";
import {
  addPositionTags,
  createPositionTag,
  deletePositionTag,
  removePositionTags,
  updatePositionTag,
} from "./actions";
import { fetchPositionTagAssignments, fetchPositionTags } from "./fetch";

const { getCurrentUser, revalidatePath } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/server/auth/actions", () => ({ getCurrentUser }));
vi.mock("next/cache", () => ({ revalidatePath }));

const userId = "10000000-0000-4000-8000-000000000001";
const positionId = "20000000-0000-4000-8000-000000000001";
const oldTag = "30000000-0000-4000-8000-000000000001";
const newTag = "30000000-0000-4000-8000-000000000002";
const keptTag = "30000000-0000-4000-8000-000000000003";
const rejected = { code: "42501", message: "Permission denied" };

interface RequestRecord {
  method: string;
  url: URL;
  body: unknown;
  headers: Headers;
}
const requests: RequestRecord[] = [];
const respond = vi.fn<(request: RequestRecord) => Response>();
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function queue(...data: unknown[]) {
  for (const value of data) respond.mockImplementationOnce(() => json(value));
}
function failNext() {
  respond.mockImplementationOnce(() => json(rejected, 403));
}
function form(tagIds?: unknown) {
  const data = new FormData();
  data.set("name", "Savings account");
  data.set("category_id", "other");
  data.set("description", "House deposit");
  data.set("capital_gains_tax_rate", "0.25");
  if (tagIds !== undefined) data.set("tag_ids", JSON.stringify(tagIds));
  return data;
}
function queueDetailsValidation({
  tagIds = [newTag, keptTag],
  current = [oldTag, keptTag],
} = {}) {
  queue([{ id: positionId, type: "asset" }], [{ id: "other" }]);
  if (tagIds.length) queue(tagIds.map((id) => ({ id })));
  queue(current.map((tag_id) => ({ position_id: positionId, tag_id })));
}
function writes() {
  return requests.filter((request) => request.method !== "GET");
}

beforeEach(() => {
  requests.length = 0;
  respond.mockReset();
  respond.mockImplementation(() => {
    throw new Error("Unexpected request");
  });
  revalidatePath.mockReset();
  const supabase = createClient<Database>("https://tags.test", "test-key", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const request = {
          method: init?.method ?? "GET",
          url: new URL(String(input)),
          body: init?.body ? JSON.parse(String(init.body)) : null,
          headers: new Headers(init?.headers),
        };
        requests.push(request);
        return respond(request);
      },
    },
  });
  getCurrentUser.mockResolvedValue({ supabase, user: { id: userId } });
});

describe("tag definitions", () => {
  it("trims names, defaults to blue, and scopes creation to the authenticated user", async () => {
    queue({ id: oldTag, name: "Dad", color: "blue", user_id: userId });
    expect(await createPositionTag({ name: "  Dad  " })).toMatchObject({
      success: true,
      tag: { name: "Dad" },
    });
    expect(writes()[0].body).toEqual({
      name: "Dad",
      color: "blue",
      user_id: userId,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it.each([
    { name: " " },
    { name: "a".repeat(65) },
    { name: "Dad", color: "invalid" },
  ])("rejects invalid tag details %j", async (input) => {
    // Exercise untrusted server-action input despite the public TypeScript contract.
    expect(
      await createPositionTag(input as Parameters<typeof createPositionTag>[0]),
    ).toMatchObject({ success: false, code: "INVALID_INPUT" });
    expect(requests).toHaveLength(0);
  });

  it("returns a friendly duplicate error", async () => {
    respond.mockReturnValueOnce(
      json({ code: "23505", message: "unique violation" }, 409),
    );
    expect(await createPositionTag({ name: "Dad" })).toMatchObject({
      success: false,
      code: "DUPLICATE_NAME",
      outcomeUnknown: false,
    });
  });

  it("renames/recolors with an owner filter and reports unavailable deletes", async () => {
    queue({ id: oldTag, name: "Retirement", color: "teal" }, null);
    expect(
      await updatePositionTag({
        id: oldTag,
        name: " Retirement ",
        color: "teal",
      }),
    ).toMatchObject({ success: true });
    expect(writes()[0].body).toEqual({ name: "Retirement", color: "teal" });
    expect(writes()[0].url.searchParams.get("user_id")).toBe(`eq.${userId}`);
    expect(await deletePositionTag(oldTag)).toMatchObject({
      success: false,
      code: "NOT_FOUND",
      outcomeUnknown: false,
    });
    expect(writes()[1].url.searchParams.get("user_id")).toBe(`eq.${userId}`);
  });
});

describe("paginated private reads", () => {
  it("reads definitions and assignments beyond the 1000-row API cap with stable ordering", async () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      id: String(index),
    }));
    queue(rows, [{ id: "last" }], rows, [{ id: "last-assignment" }]);
    expect(await fetchPositionTags()).toHaveLength(1001);
    expect(await fetchPositionTagAssignments()).toHaveLength(1001);
    expect(
      requests.map(({ url }) => [
        url.searchParams.get("offset"),
        url.searchParams.get("limit"),
        url.searchParams.get("order"),
      ]),
    ).toEqual([
      ["0", "1000", "name.asc,id.asc"],
      ["1000", "1000", "name.asc,id.asc"],
      ["0", "1000", "position_id.asc,tag_id.asc"],
      ["1000", "1000", "position_id.asc,tag_id.asc"],
    ]);
  });

  it("rejects detail reads for an unavailable asset", async () => {
    queue([]);
    await expect(fetchPositionTagAssignments(positionId)).rejects.toMatchObject(
      { code: "INVALID_TARGETS" },
    );
    expect(requests).toHaveLength(1);
  });
});

describe("cell and bulk assignments", () => {
  it.each([addPositionTags, removePositionTags])(
    "rejects an incomplete target set before writing",
    async (action) => {
      queue([], [{ id: oldTag }]);
      expect(
        await action({ positionIds: [positionId], tagIds: [oldTag] }),
      ).toMatchObject({
        success: false,
        code: "INVALID_TARGETS",
        outcomeUnknown: false,
      });
      expect(writes()).toHaveLength(0);
      expect(requests[0].url.searchParams.get("type")).toBe("eq.asset");
      expect(
        requests.every(
          ({ url }) => url.searchParams.get("user_id") === `eq.${userId}`,
        ),
      ).toBe(true);
    },
  );

  it("rejects an unavailable tag before writing", async () => {
    queue([{ id: positionId }], []);
    expect(
      await addPositionTags({ positionIds: [positionId], tagIds: [oldTag] }),
    ).toMatchObject({ code: "INVALID_TARGETS" });
    expect(writes()).toHaveLength(0);
  });

  it("deduplicates IDs and uses one conflict-ignoring bulk insert", async () => {
    queue([{ id: positionId }], [{ id: oldTag }, { id: newTag }], null);
    expect(
      await addPositionTags({
        positionIds: [positionId, positionId],
        tagIds: [oldTag, newTag, oldTag],
      }),
    ).toEqual({ success: true });
    expect(writes()).toHaveLength(1);
    expect(writes()[0].body).toEqual([
      { position_id: positionId, tag_id: oldTag },
      { position_id: positionId, tag_id: newTag },
    ]);
    expect(writes()[0].url.searchParams.get("on_conflict")).toBe(
      "position_id,tag_id",
    );
    expect(writes()[0].headers.get("Prefer")).toContain(
      "resolution=ignore-duplicates",
    );
  });

  it("removes only the requested pairs in one statement", async () => {
    queue([{ id: positionId }], [{ id: oldTag }], null);
    expect(
      await removePositionTags({ positionIds: [positionId], tagIds: [oldTag] }),
    ).toEqual({ success: true });
    expect(writes()).toHaveLength(1);
    expect(writes()[0].method).toBe("DELETE");
    expect(writes()[0].url.searchParams.get("position_id")).toBe(
      `in.(${positionId})`,
    );
    expect(writes()[0].url.searchParams.get("tag_id")).toBe(`in.(${oldTag})`);
  });

  it("chunks ownership lookups so filter URLs stay short", async () => {
    const ids = Array.from(
      { length: 1001 },
      (_, index) =>
        `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    queue(
      ...chunkArray(ids, 200).map((chunk) => chunk.map((id) => ({ id }))),
      [{ id: oldTag }],
      null,
    );
    expect(
      await addPositionTags({ positionIds: ids, tagIds: [oldTag] }),
    ).toEqual({ success: true });
    expect(writes()[0].body).toHaveLength(1001);
    const lookups = requests.filter(({ url }) =>
      url.pathname.endsWith("/positions"),
    );
    expect(lookups).toHaveLength(6);
    expect(lookups.every(({ url }) => url.href.length < 8192)).toBe(true);
  });

  it("chunks bulk removals and reports a partial failure as unknown", async () => {
    const ids = Array.from(
      { length: 201 },
      (_, index) =>
        `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    queue(
      ...chunkArray(ids, 200).map((chunk) => chunk.map((id) => ({ id }))),
      [{ id: oldTag }],
      null,
    );
    failNext();
    expect(
      await removePositionTags({ positionIds: ids, tagIds: [oldTag] }),
    ).toMatchObject({ success: false, outcomeUnknown: true });
    expect(writes()).toHaveLength(2);
    expect(writes().every(({ method }) => method === "DELETE")).toBe(true);
  });

  it("skips empty writes while still validating the requested assets", async () => {
    queue([{ id: positionId }]);
    expect(
      await addPositionTags({ positionIds: [positionId], tagIds: [] }),
    ).toEqual({ success: true });
    expect(writes()).toHaveLength(0);
  });

  it("marks a lost write response as unknown and invalidates cached views", async () => {
    queue([{ id: positionId }], [{ id: oldTag }]);
    respond.mockImplementationOnce(() => {
      throw new TypeError("Failed to fetch");
    });
    expect(
      await addPositionTags({ positionIds: [positionId], tagIds: [oldTag] }),
    ).toMatchObject({ success: false, outcomeUnknown: true });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });
});

describe("details save sequencing", () => {
  it("skips unchanged tag deltas and leaves omitted tax rates untouched", async () => {
    queueDetailsValidation({ tagIds: [keptTag], current: [keptTag] });
    queue({ id: positionId });
    const data = form([keptTag, keptTag]);
    data.delete("capital_gains_tax_rate");
    expect(await updatePosition(data, positionId)).toEqual({ success: true });
    expect(writes()).toHaveLength(1);
    expect(writes()[0].body).not.toHaveProperty("capital_gains_tax_rate");
    expect(writes()[0].url.pathname).toBe("/rest/v1/positions");
  });

  it("rejects tag changes on liabilities before writing", async () => {
    queue([{ id: positionId, type: "liability" }], [{ id: "other" }]);
    expect(await updatePosition(form([]), positionId)).toMatchObject({
      failedStep: "validation",
      code: "INVALID_TARGETS",
      savedSteps: [],
    });
    expect(writes()).toHaveLength(0);
  });

  it("rejects file and repeated tag_ids fields", async () => {
    const data = form([]);
    data.append("tag_ids", "[]");
    expect(await updatePosition(data, positionId)).toMatchObject({
      code: "INVALID_INPUT",
    });
    data.set("tag_ids", new File(["[]"], "tags.json"));
    expect(await updatePosition(data, positionId)).toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(requests).toHaveLength(0);
  });

  it("preserves tags when tag_ids is omitted", async () => {
    queue([{ id: positionId, type: "asset" }], [{ id: "other" }], {
      id: positionId,
    });
    expect(await updatePosition(form(), positionId)).toEqual({ success: true });
    expect(
      requests.some(({ url }) =>
        url.pathname.endsWith("position_tag_assignments"),
      ),
    ).toBe(false);
    expect(writes()[0].body).toMatchObject({
      name: "Savings account",
      capital_gains_tax_rate: 0.25,
    });
  });

  it.each(["not-json", "null", '["not-a-uuid"]', "{}"])(
    "rejects malformed tag_ids %s before any write",
    async (value) => {
      const data = form();
      data.set("tag_ids", value);
      expect(await updatePosition(data, positionId)).toMatchObject({
        success: false,
        failedStep: "validation",
        savedSteps: [],
        outcomeUnknown: false,
      });
      expect(requests).toHaveLength(0);
    },
  );

  it("rejects invalid details and forged tags before saving details", async () => {
    const invalid = form();
    invalid.set("capital_gains_tax_rate", "NaN");
    expect(await updatePosition(invalid, positionId)).toMatchObject({
      failedStep: "validation",
    });
    expect(requests).toHaveLength(0);
    queue([{ id: positionId, type: "asset" }], [{ id: "other" }], []);
    expect(await updatePosition(form([newTag]), positionId)).toMatchObject({
      failedStep: "validation",
      code: "INVALID_TARGETS",
    });
    expect(writes()).toHaveLength(0);
  });

  it("clears explicit empty selections only after saving details", async () => {
    queueDetailsValidation({ tagIds: [], current: [oldTag] });
    queue({ id: positionId }, null);
    expect(await updatePosition(form([]), positionId)).toEqual({
      success: true,
    });
    expect(writes().map(({ method }) => method)).toEqual(["PATCH", "DELETE"]);
    expect(writes()[1].url.searchParams.get("tag_id")).toBe(`in.(${oldTag})`);
  });

  it("writes details, adds missing tags, then removes only the delta", async () => {
    queueDetailsValidation();
    queue({ id: positionId }, null, null);
    expect(await updatePosition(form([newTag, keptTag]), positionId)).toEqual({
      success: true,
    });
    expect(writes().map(({ method }) => method)).toEqual([
      "PATCH",
      "POST",
      "DELETE",
    ]);
    expect(writes()[1].body).toEqual([
      { position_id: positionId, tag_id: newTag },
    ]);
    expect(writes()[2].url.searchParams.get("tag_id")).toBe(`in.(${oldTag})`);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it.each([
    { step: "details", commits: [], successes: [] },
    { step: "tag_add", commits: ["details"], successes: [{ id: positionId }] },
    {
      step: "tag_remove",
      commits: ["details", "tag_add"],
      successes: [{ id: positionId }, null],
    },
  ])(
    "stops at a rejected $step and reports confirmed commits",
    async ({ step, commits, successes }) => {
      queueDetailsValidation();
      queue(...successes);
      failNext();
      expect(
        await updatePosition(form([newTag, keptTag]), positionId),
      ).toMatchObject({
        success: false,
        failedStep: step,
        savedSteps: commits,
        outcomeUnknown: false,
      });
      expect(writes()).toHaveLength(successes.length + 1);
      if (commits.length)
        expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
    },
  );

  it("re-reads assignments on retry after a partial save", async () => {
    queueDetailsValidation();
    queue({ id: positionId }, null);
    failNext();
    expect(
      await updatePosition(form([newTag, keptTag]), positionId),
    ).toMatchObject({ failedStep: "tag_remove" });
    const firstWrites = writes().length;
    queueDetailsValidation({ current: [oldTag, newTag, keptTag] });
    queue({ id: positionId }, null);
    expect(await updatePosition(form([newTag, keptTag]), positionId)).toEqual({
      success: true,
    });
    expect(
      writes()
        .slice(firstWrites)
        .map(({ method }) => method),
    ).toEqual(["PATCH", "DELETE"]);
    expect(writes().at(-1)?.url.searchParams.get("tag_id")).toBe(
      `in.(${oldTag})`,
    );
  });

  it("reports unknown outcomes without claiming that a failed response rolled back", async () => {
    queueDetailsValidation();
    queue({ id: positionId });
    respond.mockImplementationOnce(() => {
      throw new TypeError("Lost response");
    });
    expect(
      await updatePosition(form([newTag, keptTag]), positionId),
    ).toMatchObject({
      failedStep: "tag_add",
      savedSteps: ["details"],
      outcomeUnknown: true,
    });
    expect(writes()).toHaveLength(2);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });
});
