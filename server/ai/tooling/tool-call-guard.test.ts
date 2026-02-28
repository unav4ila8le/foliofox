import { beforeEach, describe, expect, it, vi } from "vitest";
import { tool } from "ai";
import { z } from "zod";

import { createToolCallGuard } from "@/server/ai/tooling/tool-call-guard";

describe("createToolCallGuard", () => {
  const firstToolExecute = vi.fn();
  const secondToolExecute = vi.fn();
  const testInputSchema = z.object({
    symbolLookup: z.string().optional(),
    call: z.number().optional(),
  });

  const createTestTool = (execute: typeof firstToolExecute) =>
    tool({
      inputSchema: testInputSchema,
      execute: async (input) => execute(input),
    });

  beforeEach(() => {
    firstToolExecute.mockReset();
    secondToolExecute.mockReset();
  });

  it("deduplicates same-tool calls with identical input", async () => {
    firstToolExecute.mockImplementation(async (input: unknown) => {
      return { echoed: input };
    });

    const { guardedTools } = createToolCallGuard(
      {
        firstTool: createTestTool(firstToolExecute),
      },
      {
        maxTotalCallsPerTurn: 8,
        maxCallsPerToolPerTurn: 4,
        enableExactInputDeduplication: true,
      },
    );

    const [firstResult, secondResult] = await Promise.all([
      guardedTools.firstTool.execute!({ symbolLookup: "AAPL" }, {} as never),
      guardedTools.firstTool.execute!({ symbolLookup: "AAPL" }, {} as never),
    ]);

    expect(firstToolExecute).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(secondResult);
  });

  it("enforces per-tool call budget", async () => {
    firstToolExecute.mockResolvedValue({ ok: true });

    const { guardedTools } = createToolCallGuard(
      {
        firstTool: createTestTool(firstToolExecute),
      },
      {
        maxTotalCallsPerTurn: 10,
        maxCallsPerToolPerTurn: 2,
        enableExactInputDeduplication: false,
      },
    );

    await guardedTools.firstTool.execute!({ call: 1 }, {} as never);
    await guardedTools.firstTool.execute!({ call: 2 }, {} as never);

    await expect(
      guardedTools.firstTool.execute!({ call: 3 }, {} as never),
    ).rejects.toThrow(
      'Tool "firstTool" reached per-turn call budget (2 calls per tool).',
    );
  });

  it("enforces total call budget across tools", async () => {
    firstToolExecute.mockResolvedValue({ ok: true });
    secondToolExecute.mockResolvedValue({ ok: true });

    const { guardedTools } = createToolCallGuard(
      {
        firstTool: createTestTool(firstToolExecute),
        secondTool: createTestTool(secondToolExecute),
      },
      {
        maxTotalCallsPerTurn: 3,
        maxCallsPerToolPerTurn: 3,
        enableExactInputDeduplication: false,
      },
    );

    await guardedTools.firstTool.execute!({ call: 1 }, {} as never);
    await guardedTools.secondTool.execute!({ call: 2 }, {} as never);
    await guardedTools.firstTool.execute!({ call: 3 }, {} as never);

    await expect(
      guardedTools.secondTool.execute!({ call: 4 }, {} as never),
    ).rejects.toThrow("Tool call budget reached (3 total calls per turn).");
  });
});
