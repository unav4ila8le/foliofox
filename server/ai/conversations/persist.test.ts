import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UIMessage } from "ai";
import {
  MAX_CONVERSATIONS_PER_USER,
  MAX_PERSISTED_MESSAGES_PER_CONVERSATION,
} from "@/lib/ai/chat-guardrails-config";

type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ConversationMessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "assistant" | "user" | "system" | "tool";
  content: string;
  model: string | null;
  usage_tokens: number | null;
  created_at: string;
  order: number;
  parts: unknown[];
};

type SupportedTable = "conversations" | "conversation_messages";

class FakeQueryBuilder<T extends Record<string, unknown>> {
  private selectedColumns: string[] | null = null;
  private selectCountMode: "exact" | null = null;
  private selectHead = false;
  private filters: Array<{
    type: "eq" | "in";
    column: string;
    value: unknown;
  }> = [];
  private orderBy: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private operation: "select" | "update" | "delete" = "select";
  private updatePayload: Partial<T> = {};

  constructor(
    private readonly rowsRef: T[],
    private readonly deleteRows: (rowsToDelete: T[]) => void,
    private readonly normalizeInsertRow: (row: Partial<T>) => T,
  ) {}

  select(
    columns: string,
    options?: {
      count?: "exact";
      head?: boolean;
    },
  ) {
    this.operation = "select";
    this.selectedColumns =
      columns === "*" ? null : columns.split(",").map((c) => c.trim());
    this.selectCountMode = options?.count ?? null;
    this.selectHead = options?.head ?? false;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: "in", column, value });
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.orderBy.push({
      column,
      ascending: options.ascending,
    });
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  async maybeSingle() {
    const result_2 = await this.execute();
    const firstRow = Array.isArray(result_2.data)
      ? (result_2.data[0] ?? null)
      : result_2.data;
    return {
      ...result_2,
      data: firstRow,
    };
  }

  insert(value: Partial<T> | Partial<T>[]) {
    const rows = Array.isArray(value) ? value : [value];
    rows.forEach((row) => this.rowsRef.push(this.normalizeInsertRow(row)));
    return Promise.resolve({ data: null, error: null });
  }

  update(value: Partial<T>) {
    this.operation = "update";
    this.updatePayload = value;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: T[] | null;
          count: number | null;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(
      onfulfilled ?? undefined,
      onrejected ?? undefined,
    );
  }

  private execute() {
    const matchedRows = this.getRows();

    if (this.operation === "update") {
      matchedRows.forEach((row) => Object.assign(row, this.updatePayload));
      return Promise.resolve({ data: matchedRows, count: null, error: null });
    }

    if (this.operation === "delete") {
      this.deleteRows(matchedRows);
      return Promise.resolve({ data: null, count: null, error: null });
    }

    const count = this.selectCountMode === "exact" ? matchedRows.length : null;
    if (this.selectHead) {
      return Promise.resolve({ data: null, count, error: null });
    }

    const selectedRows =
      this.selectedColumns == null
        ? matchedRows
        : matchedRows.map((row) => {
            return this.selectedColumns!.reduce<Record<string, unknown>>(
              (acc, column) => {
                acc[column] = row[column];
                return acc;
              },
              {},
            );
          });

    return Promise.resolve({ data: selectedRows as T[], count, error: null });
  }

  private getRows(): T[] {
    let rows = [...this.rowsRef];

    rows = rows.filter((row) => {
      return this.filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.column] === filter.value;
        }

        const values = filter.value as unknown[];
        return values.includes(row[filter.column]);
      });
    });

    if (this.orderBy.length > 0) {
      rows.sort((left, right) => {
        for (const clause of this.orderBy) {
          const leftValue = left[clause.column];
          const rightValue = right[clause.column];
          if (leftValue === rightValue) continue;
          if (leftValue == null) return 1;
          if (rightValue == null) return -1;
          const compare = leftValue > rightValue ? 1 : -1;
          return clause.ascending ? compare : -compare;
        }
        return 0;
      });
    }

    if (this.limitCount != null) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows;
  }
}

class FakeSupabaseClient {
  public conversations: ConversationRow[] = [];
  public conversationMessages: ConversationMessageRow[] = [];
  public currentUserId = "user-1";
  public auth = {
    getUser: async () => ({
      data: { user: { id: this.currentUserId } },
    }),
  };

  from(table: SupportedTable) {
    if (table === "conversations") {
      return new FakeQueryBuilder<ConversationRow>(
        this.conversations,
        (rowsToDelete) => {
          const idsToDelete = new Set(rowsToDelete.map((row) => row.id));
          this.conversations = this.conversations.filter(
            (row) => !idsToDelete.has(row.id),
          );
        },
        (row) => ({
          id: String(row.id ?? `conv-generated-${++rowIdCounter}`),
          user_id: String(row.user_id),
          title: String(row.title ?? "Conversation"),
          created_at: String(row.created_at ?? new Date().toISOString()),
          updated_at: String(row.updated_at ?? new Date().toISOString()),
        }),
      );
    }

    return new FakeQueryBuilder<ConversationMessageRow>(
      this.conversationMessages,
      (rowsToDelete) => {
        const idsToDelete = new Set(rowsToDelete.map((row) => row.id));
        this.conversationMessages = this.conversationMessages.filter(
          (row) => !idsToDelete.has(row.id),
        );
      },
      (row) => ({
        id: String(row.id ?? `msg-generated-${++rowIdCounter}`),
        conversation_id: String(row.conversation_id),
        user_id: String(row.user_id),
        role: row.role as ConversationMessageRow["role"],
        content: String(row.content ?? ""),
        model: (row.model as string | null | undefined) ?? null,
        usage_tokens: (row.usage_tokens as number | null | undefined) ?? null,
        created_at: String(row.created_at ?? new Date().toISOString()),
        order: Number(row.order ?? 0),
        parts: Array.isArray(row.parts) ? row.parts : [],
      }),
    );
  }
}

let fakeSupabase = new FakeSupabaseClient();
let idCounter = 0;
let rowIdCounter = 0;

vi.mock("@/supabase/server", () => ({
  createClient: async () => fakeSupabase,
}));

const createUserMessage = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

const createAssistantMessage = (id: string, text: string): UIMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text }],
});

describe("conversation persistence guardrails", () => {
  beforeEach(() => {
    fakeSupabase = new FakeSupabaseClient();
    idCounter = 0;
    rowIdCounter = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-08T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks new conversation creation when user is already at cap", async () => {
    const { persistConversationFromMessages } =
      await import("@/server/ai/conversations/persist");
    const { AI_CHAT_ERROR_CODES } = await import("@/lib/ai/chat-errors");

    fakeSupabase.conversations = Array.from(
      { length: MAX_CONVERSATIONS_PER_USER },
      (_, index) => ({
        id: `conv-${index}`,
        user_id: "user-1",
        title: `Conversation ${index}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    );

    await expect(
      persistConversationFromMessages({
        conversationId: "new-conversation",
        messages: [createUserMessage("m-1", "hello")],
      }),
    ).rejects.toMatchObject({
      code: AI_CHAT_ERROR_CODES.conversationCapReached,
    });
  });

  it("allows existing conversation to continue when user is at cap", async () => {
    const { persistConversationFromMessages } =
      await import("@/server/ai/conversations/persist");

    fakeSupabase.conversations = Array.from(
      { length: MAX_CONVERSATIONS_PER_USER },
      (_, index) => ({
        id: index === 0 ? "existing-conversation" : `conv-${index}`,
        user_id: "user-1",
        title: `Conversation ${index}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    );

    await persistConversationFromMessages({
      conversationId: "existing-conversation",
      messages: [createUserMessage("m-1", "continue thread")],
    });

    expect(fakeSupabase.conversationMessages).toHaveLength(1);
    expect(fakeSupabase.conversationMessages[0]?.content).toBe(
      "continue thread",
    );
  });

  it("trims persisted history to configured rolling window size", async () => {
    const { persistConversationFromMessages } =
      await import("@/server/ai/conversations/persist");

    fakeSupabase.conversations = [
      {
        id: "trim-conversation",
        user_id: "user-1",
        title: "Trim Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const overflowMessageCount = 10;
    const totalInsertedMessages =
      MAX_PERSISTED_MESSAGES_PER_CONVERSATION + overflowMessageCount;

    for (let index = 0; index < totalInsertedMessages; index += 1) {
      idCounter += 1;
      await persistConversationFromMessages({
        conversationId: "trim-conversation",
        messages: [createUserMessage(`m-${idCounter}`, `message-${index}`)],
      });
    }

    const orderedMessages = [...fakeSupabase.conversationMessages].sort(
      (left, right) => left.order - right.order,
    );

    expect(orderedMessages).toHaveLength(
      MAX_PERSISTED_MESSAGES_PER_CONVERSATION,
    );
    expect(orderedMessages[0]?.content).toBe(`message-${overflowMessageCount}`);
    expect(orderedMessages.at(-1)?.content).toBe(
      `message-${totalInsertedMessages - 1}`,
    );
  });

  it("skips persistence when persistAssistantMessage receives non-assistant role", async () => {
    const { persistAssistantMessage } =
      await import("@/server/ai/conversations/persist");

    fakeSupabase.conversations = [
      {
        id: "assistant-skip-conversation",
        user_id: "user-1",
        title: "Assistant Skip Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await persistAssistantMessage({
      conversationId: "assistant-skip-conversation",
      message: createUserMessage("u-skip", "this should be ignored"),
      usageTokens: 99,
    });

    expect(fakeSupabase.conversationMessages).toHaveLength(0);
  });

  it("persists assistant message and trims when over message cap", async () => {
    const { persistAssistantMessage } =
      await import("@/server/ai/conversations/persist");

    fakeSupabase.conversations = [
      {
        id: "assistant-trim-conversation",
        user_id: "user-1",
        title: "Assistant Trim Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    fakeSupabase.conversationMessages = Array.from(
      { length: MAX_PERSISTED_MESSAGES_PER_CONVERSATION },
      (_, index) => ({
        id: `existing-${index}`,
        conversation_id: "assistant-trim-conversation",
        user_id: "user-1",
        role: "user",
        content: `existing-${index}`,
        model: "seed-model",
        usage_tokens: null,
        created_at: new Date().toISOString(),
        order: index,
        parts: [{ type: "text", text: `existing-${index}` }],
      }),
    );

    await persistAssistantMessage({
      conversationId: "assistant-trim-conversation",
      message: createAssistantMessage("assistant-new", "assistant newest"),
      model: "assistant-model",
      usageTokens: 321,
    });

    const orderedMessages = [...fakeSupabase.conversationMessages].sort(
      (left, right) => left.order - right.order,
    );
    const newestAssistantMessage = orderedMessages.at(-1);

    expect(orderedMessages).toHaveLength(
      MAX_PERSISTED_MESSAGES_PER_CONVERSATION,
    );
    expect(orderedMessages[0]?.content).toBe("existing-1");
    expect(newestAssistantMessage?.content).toBe("assistant newest");
    expect(newestAssistantMessage?.role).toBe("assistant");
    expect(newestAssistantMessage?.model).toBe("assistant-model");
    expect(newestAssistantMessage?.usage_tokens).toBe(321);
  });

  it("drops file parts from persisted messages", async () => {
    const { persistConversationFromMessages, persistAssistantMessage } =
      await import("@/server/ai/conversations/persist");

    fakeSupabase.conversations = [
      {
        id: "file-parts-conversation",
        user_id: "user-1",
        title: "File Parts Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await persistConversationFromMessages({
      conversationId: "file-parts-conversation",
      messages: [
        {
          id: "user-with-file",
          role: "user",
          parts: [
            { type: "text", text: "please review this" },
            {
              type: "file",
              filename: "statement.pdf",
              mediaType: "application/pdf",
              url: "data:application/pdf;base64,Zm9v",
            },
          ],
        } as UIMessage,
      ],
    });

    await persistAssistantMessage({
      conversationId: "file-parts-conversation",
      message: {
        id: "assistant-with-file",
        role: "assistant",
        parts: [
          { type: "text", text: "I reviewed your attachment." },
          {
            type: "file",
            filename: "report.pdf",
            mediaType: "application/pdf",
            url: "data:application/pdf;base64,YmFy",
          },
        ],
      } as UIMessage,
    });

    const [firstMessage, secondMessage] = fakeSupabase.conversationMessages;
    expect(firstMessage?.parts).toEqual([
      { type: "text", text: "please review this" },
    ]);
    expect(secondMessage?.parts).toEqual([
      { type: "text", text: "I reviewed your attachment." },
    ]);
  });

  it("replaces latest assistant response on regenerate flow", async () => {
    const { persistConversationFromMessages, persistAssistantMessage } =
      await import("@/server/ai/conversations/persist");

    fakeSupabase.conversations = [
      {
        id: "regen-conversation",
        user_id: "user-1",
        title: "Regen Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await persistConversationFromMessages({
      conversationId: "regen-conversation",
      messages: [createUserMessage("u-1", "What should I do?")],
    });

    await persistAssistantMessage({
      conversationId: "regen-conversation",
      message: createAssistantMessage("a-1", "Old response"),
      usageTokens: 123,
    });

    await persistAssistantMessage({
      conversationId: "regen-conversation",
      message: createAssistantMessage("a-2", "New response"),
      usageTokens: 321,
      replaceLatestAssistantForRegenerate: true,
    });

    const assistantRows = fakeSupabase.conversationMessages.filter(
      (message) => message.role === "assistant",
    );

    expect(assistantRows).toHaveLength(1);
    expect(assistantRows[0]?.content).toBe("New response");
  });

  it("replaces targeted assistant message id during regenerate when available", async () => {
    const { persistAssistantMessage } =
      await import("@/server/ai/conversations/persist");

    const targetAssistantId = "11111111-1111-4111-8111-111111111111";
    const latestAssistantId = "22222222-2222-4222-8222-222222222222";

    fakeSupabase.conversations = [
      {
        id: "regen-target-conversation",
        user_id: "user-1",
        title: "Regen Target Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    fakeSupabase.conversationMessages = [
      {
        id: "user-seed",
        conversation_id: "regen-target-conversation",
        user_id: "user-1",
        role: "user",
        content: "Question",
        model: "seed-model",
        usage_tokens: null,
        created_at: new Date().toISOString(),
        order: 0,
        parts: [{ type: "text", text: "Question" }],
      },
      {
        id: targetAssistantId,
        conversation_id: "regen-target-conversation",
        user_id: "user-1",
        role: "assistant",
        content: "Older assistant",
        model: "seed-model",
        usage_tokens: null,
        created_at: new Date().toISOString(),
        order: 1,
        parts: [{ type: "text", text: "Older assistant" }],
      },
      {
        id: latestAssistantId,
        conversation_id: "regen-target-conversation",
        user_id: "user-1",
        role: "assistant",
        content: "Latest assistant",
        model: "seed-model",
        usage_tokens: null,
        created_at: new Date().toISOString(),
        order: 2,
        parts: [{ type: "text", text: "Latest assistant" }],
      },
    ];

    await persistAssistantMessage({
      conversationId: "regen-target-conversation",
      message: createAssistantMessage("assistant-new", "Replacement response"),
      replaceLatestAssistantForRegenerate: true,
      targetAssistantMessageIdForRegenerate: targetAssistantId,
    });

    const assistantRows = fakeSupabase.conversationMessages.filter(
      (message) => message.role === "assistant",
    );
    const assistantIds = assistantRows.map((message) => message.id);

    expect(assistantIds).not.toContain(targetAssistantId);
    expect(assistantIds).toContain(latestAssistantId);
    expect(
      assistantRows.some(
        (message) => message.content === "Replacement response",
      ),
    ).toBe(true);
  });
});
