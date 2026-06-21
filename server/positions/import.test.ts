import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const createPositionMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/server/positions/create", () => ({
  createPosition: createPositionMock,
}));

vi.mock("@/server/currencies/fetch", () => ({
  fetchCurrencies: async () => [
    {
      alphabetic_code: "EUR",
      name: "Euro",
    },
  ],
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

class FakeQuery {
  select() {
    return this;
  }

  eq() {
    return this;
  }

  is() {
    return this;
  }

  in() {
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: [], error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

describe("importPositionsFromCSV", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getCurrentUserMock.mockImplementation(() => ({
      supabase: {
        from: () => new FakeQuery(),
      },
      user: { id: "user-1" },
    }));

    createPositionMock.mockReset();
    createPositionMock.mockReturnValue({ success: true });
    revalidatePathMock.mockReset();
  });

  it("imports positions CSVs without routing broker imports through assets", async () => {
    const csv =
      "name,category_id,currency,quantity,unit_value\nAcme,equity,EUR,2,10";

    const { importPositionsFromCSV } = await import("./import");
    const result = await importPositionsFromCSV(csv);

    expect(result).toMatchObject({ success: true, importedCount: 1 });
    expect(createPositionMock).toHaveBeenCalledTimes(1);
    const formData = createPositionMock.mock.calls[0][0] as FormData;
    expect(formData.get("name")).toBe("Acme");
    expect(formData.get("quantity")).toBe("2");
  });
});
