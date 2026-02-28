import type { ToolSet } from "ai";

export interface ToolCallGuardConfig {
  maxTotalCallsPerTurn: number;
  maxCallsPerToolPerTurn: number;
  enableExactInputDeduplication: boolean;
}

interface ToolCallGuardInternalState {
  totalCalls: number;
  perToolCalls: Map<string, number>;
  inFlightOrCachedCalls: Map<string, Promise<unknown>>;
}

export interface ToolCallGuardState {
  getTotalCalls: () => number;
  getCallsForTool: (toolName: string) => number;
}

const DEFAULT_TOOL_CALL_GUARD_CONFIG: ToolCallGuardConfig = {
  maxTotalCallsPerTurn: 8,
  maxCallsPerToolPerTurn: 4,
  enableExactInputDeduplication: true,
};

function normalizeForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStableStringify(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        normalized[key] = normalizeForStableStringify(record[key]);
        return normalized;
      }, {});
  }

  return value;
}

function buildToolInputCacheKey(toolName: string, input: unknown): string {
  return `${toolName}:${JSON.stringify(normalizeForStableStringify(input))}`;
}

function buildBudgetExceededErrorMessage(params: {
  toolName: string;
  maxTotalCallsPerTurn: number;
  maxCallsPerToolPerTurn: number;
  totalCalls: number;
  toolCalls: number;
}): string {
  if (params.totalCalls >= params.maxTotalCallsPerTurn) {
    return `Tool call budget reached (${params.maxTotalCallsPerTurn} total calls per turn). Please narrow the scope.`;
  }

  return `Tool "${params.toolName}" reached per-turn call budget (${params.maxCallsPerToolPerTurn} calls per tool). Please narrow the scope.`;
}

/**
 * Create guarded tools with global/per-tool call budgets and exact-input deduplication.
 * Duplicate calls (same tool + same input) reuse the same promise/result.
 */
export function createToolCallGuard<TOOL_SET extends ToolSet>(
  tools: TOOL_SET,
  config: Partial<ToolCallGuardConfig> = {},
): {
  guardedTools: TOOL_SET;
  guardState: ToolCallGuardState;
} {
  const guardConfig = {
    ...DEFAULT_TOOL_CALL_GUARD_CONFIG,
    ...config,
  };

  const internalState: ToolCallGuardInternalState = {
    totalCalls: 0,
    perToolCalls: new Map<string, number>(),
    inFlightOrCachedCalls: new Map<string, Promise<unknown>>(),
  };

  const guardedTools = Object.fromEntries(
    Object.entries(tools).map(([toolName, toolDefinition]) => {
      const originalExecute = toolDefinition.execute;

      if (typeof originalExecute !== "function") {
        return [toolName, toolDefinition];
      }

      const guardedDefinition = {
        ...toolDefinition,
        execute: async (input: unknown, options?: unknown) => {
          const toolCalls = internalState.perToolCalls.get(toolName) ?? 0;
          const cacheKey = buildToolInputCacheKey(toolName, input);

          if (guardConfig.enableExactInputDeduplication) {
            const cachedPromise =
              internalState.inFlightOrCachedCalls.get(cacheKey);
            if (cachedPromise) {
              // Budget counts actual tool executions.
              // Exact same tool+input reuses one execution and does not consume extra budget.
              return cachedPromise;
            }
          }

          const budgetExceeded =
            internalState.totalCalls >= guardConfig.maxTotalCallsPerTurn ||
            toolCalls >= guardConfig.maxCallsPerToolPerTurn;

          if (budgetExceeded) {
            throw new Error(
              buildBudgetExceededErrorMessage({
                toolName,
                maxTotalCallsPerTurn: guardConfig.maxTotalCallsPerTurn,
                maxCallsPerToolPerTurn: guardConfig.maxCallsPerToolPerTurn,
                totalCalls: internalState.totalCalls,
                toolCalls,
              }),
            );
          }

          internalState.totalCalls += 1;
          internalState.perToolCalls.set(toolName, toolCalls + 1);

          const executionPromise = Promise.resolve(
            (originalExecute as (...args: unknown[]) => unknown)(
              input,
              options,
            ),
          );

          if (guardConfig.enableExactInputDeduplication) {
            internalState.inFlightOrCachedCalls.set(cacheKey, executionPromise);
          }

          try {
            return await executionPromise;
          } catch (error) {
            // Keep successful calls cached, but allow retries after failures.
            if (guardConfig.enableExactInputDeduplication) {
              internalState.inFlightOrCachedCalls.delete(cacheKey);
            }
            throw error;
          }
        },
      };

      return [toolName, guardedDefinition];
    }),
  ) as TOOL_SET;

  return {
    guardedTools,
    guardState: {
      getTotalCalls: () => internalState.totalCalls,
      getCallsForTool: (toolName: string) =>
        internalState.perToolCalls.get(toolName) ?? 0,
    },
  };
}
