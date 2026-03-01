import { beforeEach, describe, expect, it, vi } from "vitest";

const streamTextMock = vi.fn();
const convertToModelMessagesMock = vi.fn(async (messages) => messages);
const safeValidateUIMessagesMock = vi.fn();
const stepCountIsMock = vi.fn(() => "stop-condition");
const buildGuardrailedModelContextMock = vi.fn((messages) => messages);
const fetchProfileMock = vi.fn();
const persistConversationFromMessagesMock = vi.fn();
const persistAssistantMessageMock = vi.fn();
const trackAssistantTurnMock = vi.fn();
const createSystemPromptMock = vi.fn(() => "system prompt");
const getPortfolioOverviewToolExecuteMock = vi.fn(async () => ({ ok: true }));
const searchSymbolsToolExecuteMock = vi.fn(async () => ({ ok: true }));

class MockAIChatPersistenceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let capturedOnFinish:
  | ((params: {
      responseMessage: unknown;
      isAborted: boolean;
      finishReason?: string;
    }) => Promise<void>)
  | undefined;

vi.mock("ai", () => ({
  streamText: streamTextMock,
  convertToModelMessages: convertToModelMessagesMock,
  safeValidateUIMessages: safeValidateUIMessagesMock,
  stepCountIs: stepCountIsMock,
}));

vi.mock("@/server/profile/actions", () => ({
  fetchProfile: fetchProfileMock,
}));

vi.mock("@/server/ai/system-prompt", () => ({
  createSystemPrompt: createSystemPromptMock,
}));

vi.mock("@/server/ai/tools", () => ({
  aiTools: {
    getPortfolioOverview: { execute: getPortfolioOverviewToolExecuteMock },
    searchSymbols: { execute: searchSymbolsToolExecuteMock },
  },
}));

vi.mock("@/server/ai/provider", () => ({
  aiModel: vi.fn(() => "model"),
  chatModelId: "gpt-5-mini",
}));

vi.mock("@/server/ai/chat-guardrails", () => ({
  buildGuardrailedModelContext: buildGuardrailedModelContextMock,
}));

vi.mock("@/server/ai/conversations/persist", () => ({
  AIChatPersistenceError: MockAIChatPersistenceError,
  persistConversationFromMessages: persistConversationFromMessagesMock,
  persistAssistantMessage: persistAssistantMessageMock,
}));

vi.mock("@/server/ai/telemetry/track-assistant-turn", () => ({
  trackAssistantTurn: trackAssistantTurnMock,
}));

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    capturedOnFinish = undefined;
    streamTextMock.mockReset();
    convertToModelMessagesMock.mockClear();
    safeValidateUIMessagesMock.mockReset();
    stepCountIsMock.mockClear();
    buildGuardrailedModelContextMock.mockClear();
    fetchProfileMock.mockReset();
    persistConversationFromMessagesMock.mockReset();
    persistAssistantMessageMock.mockReset();
    trackAssistantTurnMock.mockReset();
    createSystemPromptMock.mockClear();
    getPortfolioOverviewToolExecuteMock.mockReset();
    searchSymbolsToolExecuteMock.mockReset();

    streamTextMock.mockReturnValue({
      totalUsage: Promise.resolve({ totalTokens: 222 }),
      toUIMessageStreamResponse: ({
        onFinish,
      }: {
        onFinish: (params: {
          responseMessage: unknown;
          isAborted: boolean;
          finishReason?: string;
        }) => Promise<void>;
      }) => {
        capturedOnFinish = onFinish;
        return new Response("ok", { status: 200 });
      },
    });
    safeValidateUIMessagesMock.mockImplementation(async ({ messages }) => ({
      success: true,
      data: messages,
    }));
    getPortfolioOverviewToolExecuteMock.mockResolvedValue({ ok: true });
    searchSymbolsToolExecuteMock.mockResolvedValue({ ok: true });
  });

  it("returns 403 when AI consent is disabled", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    fetchProfileMock.mockResolvedValue({
      profile: { data_sharing_consent: false },
    });

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-1",
            role: "user",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("returns 400 when UI messages fail validation", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    safeValidateUIMessagesMock.mockResolvedValueOnce({
      success: false,
      error: new Error("invalid"),
    });

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ id: "bad", role: "user", parts: [{ foo: "bar" }] }],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(fetchProfileMock).not.toHaveBeenCalled();
  });

  it("returns 400 when latest user message has unsupported file type", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-file",
            role: "user",
            parts: [
              { type: "text", text: "check this" },
              {
                type: "file",
                filename: "script.exe",
                mediaType: "application/x-msdownload",
                url: "data:application/x-msdownload;base64,AAAA",
              },
            ],
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain(
      "Allowed file types: image/*, application/pdf.",
    );
    expect(fetchProfileMock).not.toHaveBeenCalled();
  });

  it("returns 400 when file part mediaType does not match data url media type", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-file-mismatch",
            role: "user",
            parts: [
              { type: "text", text: "check this" },
              {
                type: "file",
                filename: "statement.pdf",
                mediaType: "image/png",
                url: "data:application/pdf;base64,AAAA",
              },
            ],
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Invalid file payload format.");
    expect(fetchProfileMock).not.toHaveBeenCalled();
  });

  it("returns 400 when latest user message has too many file parts", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-many-files",
            role: "user",
            parts: [
              { type: "text", text: "many files" },
              {
                type: "file",
                filename: "one.pdf",
                mediaType: "application/pdf",
                url: "data:application/pdf;base64,AAAA",
              },
              {
                type: "file",
                filename: "two.pdf",
                mediaType: "application/pdf",
                url: "data:application/pdf;base64,AAAA",
              },
              {
                type: "file",
                filename: "three.pdf",
                mediaType: "application/pdf",
                url: "data:application/pdf;base64,AAAA",
              },
              {
                type: "file",
                filename: "four.pdf",
                mediaType: "application/pdf",
                url: "data:application/pdf;base64,AAAA",
              },
            ],
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain("up to 3 files");
    expect(fetchProfileMock).not.toHaveBeenCalled();
  });

  it("returns 409 with a friendly message when conversation cap is reached", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    const { AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE, AI_CHAT_ERROR_CODES } =
      await import("@/lib/ai/chat-errors");

    fetchProfileMock.mockResolvedValue({
      profile: { data_sharing_consent: true },
    });
    persistConversationFromMessagesMock.mockRejectedValue(
      new MockAIChatPersistenceError(
        AI_CHAT_ERROR_CODES.conversationCapReached,
        AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE,
      ),
    );

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-1",
            role: "user",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
        trigger: "submit-message",
      }),
      headers: {
        "Content-Type": "application/json",
        "x-ff-conversation-id": "76a2ace1-3165-4d5d-9552-c864ac08f130",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    await expect(response.text()).resolves.toContain(
      "Delete an older conversation",
    );
  });

  it("persists user turn only for submit trigger", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    fetchProfileMock.mockResolvedValue({
      profile: { data_sharing_consent: true },
    });

    const baseHeaders = {
      "Content-Type": "application/json",
      "x-ff-conversation-id": "76a2ace1-3165-4d5d-9552-c864ac08f130",
    };

    const submitRequest = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-1",
            role: "user",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
        trigger: "submit-message",
      }),
      headers: baseHeaders,
    });

    const regenerateRequest = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-2",
            role: "user",
            parts: [{ type: "text", text: "hello again" }],
          },
        ],
        trigger: "regenerate-message",
      }),
      headers: baseHeaders,
    });

    await POST(submitRequest);
    await POST(regenerateRequest);

    expect(persistConversationFromMessagesMock).toHaveBeenCalledTimes(1);
    expect(persistConversationFromMessagesMock).toHaveBeenCalledWith({
      conversationId: "76a2ace1-3165-4d5d-9552-c864ac08f130",
      messages: [
        {
          id: "m-1",
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
    });
  });

  it("sends guardrailed context to model conversion and persists assistant response on finish", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    fetchProfileMock.mockResolvedValue({
      profile: { data_sharing_consent: true },
    });

    const requestMessages = [
      {
        id: "m-1",
        role: "user",
        parts: [{ type: "text", text: "original message" }],
      },
    ];
    const guardrailedMessages = [
      {
        id: "m-guard",
        role: "user",
        parts: [{ type: "text", text: "guardrailed message" }],
      },
    ];
    buildGuardrailedModelContextMock.mockReturnValue(guardrailedMessages);

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: requestMessages,
      }),
      headers: {
        "Content-Type": "application/json",
        "x-ff-conversation-id": "76a2ace1-3165-4d5d-9552-c864ac08f130",
      },
    });

    await POST(request);

    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 8000,
        providerOptions: {
          openai: {
            reasoningSummary: "auto",
            reasoningEffort: "medium",
          },
        },
      }),
    );
    expect(convertToModelMessagesMock).toHaveBeenCalledWith(
      guardrailedMessages,
    );
    expect(capturedOnFinish).toBeDefined();

    await capturedOnFinish?.({
      responseMessage: {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "assistant response" }],
      },
      isAborted: false,
      finishReason: "stop",
    });

    expect(persistAssistantMessageMock).toHaveBeenCalledWith({
      conversationId: "76a2ace1-3165-4d5d-9552-c864ac08f130",
      message: {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "assistant response" }],
      },
      model: "gpt-5-mini",
      usageTokens: 222,
      replaceLatestAssistantForRegenerate: false,
      targetAssistantMessageIdForRegenerate: undefined,
    });
    expect(trackAssistantTurnMock).toHaveBeenCalledWith({
      conversationId: "76a2ace1-3165-4d5d-9552-c864ac08f130",
      assistantMessageId: "assistant-1",
      model: "gpt-5-mini",
      promptSource: "typed",
      message: {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "assistant response" }],
      },
      finishReason: "stop",
    });
  });

  it("passes regenerate replacement metadata to assistant persistence", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    fetchProfileMock.mockResolvedValue({
      profile: { data_sharing_consent: true },
    });

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-user",
            role: "user",
            parts: [{ type: "text", text: "retry please" }],
          },
        ],
        trigger: "regenerate-message",
        messageId: "assistant-target-id",
      }),
      headers: {
        "Content-Type": "application/json",
        "x-ff-conversation-id": "76a2ace1-3165-4d5d-9552-c864ac08f130",
      },
    });

    await POST(request);

    await capturedOnFinish?.({
      responseMessage: {
        id: "assistant-regen",
        role: "assistant",
        parts: [{ type: "text", text: "replacement response" }],
      },
      isAborted: false,
      finishReason: "stop",
    });

    expect(persistAssistantMessageMock).toHaveBeenCalledWith({
      conversationId: "76a2ace1-3165-4d5d-9552-c864ac08f130",
      message: {
        id: "assistant-regen",
        role: "assistant",
        parts: [{ type: "text", text: "replacement response" }],
      },
      model: "gpt-5-mini",
      usageTokens: 222,
      replaceLatestAssistantForRegenerate: true,
      targetAssistantMessageIdForRegenerate: "assistant-target-id",
    });
  });

  it("forces portfolio overview on first step and disables tools when budget is exhausted", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    fetchProfileMock.mockResolvedValue({
      profile: { data_sharing_consent: true },
    });

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-user",
            role: "user",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    await POST(request);

    const streamArgs = streamTextMock.mock.calls.at(-1)?.[0] as {
      prepareStep: (args: { stepNumber: number }) => Promise<unknown>;
      tools: Record<
        string,
        { execute?: (input: unknown, options?: unknown) => Promise<unknown> }
      >;
      stopWhen: Array<() => boolean>;
    };
    expect(streamArgs).toBeDefined();

    const firstStepPlan = await streamArgs.prepareStep({ stepNumber: 0 });
    expect(firstStepPlan).toEqual({
      toolChoice: { type: "tool", toolName: "getPortfolioOverview" },
      activeTools: ["getPortfolioOverview"],
    });

    const overviewTool = streamArgs.tools.getPortfolioOverview;
    const searchSymbolsTool = streamArgs.tools.searchSymbols;
    expect(overviewTool?.execute).toBeDefined();
    expect(searchSymbolsTool?.execute).toBeDefined();

    for (let call = 0; call < 4; call += 1) {
      await overviewTool!.execute!({ call, tool: "overview" }, {} as never);
      await searchSymbolsTool!.execute!({ call, tool: "search" }, {} as never);
    }

    const afterBudgetPlan = await streamArgs.prepareStep({ stepNumber: 1 });
    expect(afterBudgetPlan).toEqual({ activeTools: [] });
    expect(streamArgs.stopWhen[1]?.()).toBe(true);
  });

  it("passes suggestion prompt source to telemetry when provided", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    fetchProfileMock.mockResolvedValue({
      profile: { data_sharing_consent: true },
    });

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-user",
            role: "user",
            parts: [{ type: "text", text: "show me ideas" }],
          },
        ],
        promptSource: "suggestion",
      }),
      headers: {
        "Content-Type": "application/json",
        "x-ff-conversation-id": "76a2ace1-3165-4d5d-9552-c864ac08f130",
      },
    });

    await POST(request);

    await capturedOnFinish?.({
      responseMessage: {
        id: "assistant-suggestion",
        role: "assistant",
        parts: [{ type: "text", text: "suggestion response" }],
      },
      isAborted: false,
      finishReason: "stop",
    });

    expect(trackAssistantTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        promptSource: "suggestion",
      }),
    );
  });

  it("defaults invalid prompt source to typed", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    fetchProfileMock.mockResolvedValue({
      profile: { data_sharing_consent: true },
    });

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-user",
            role: "user",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
        promptSource: "invalid-source",
      }),
      headers: {
        "Content-Type": "application/json",
        "x-ff-conversation-id": "76a2ace1-3165-4d5d-9552-c864ac08f130",
      },
    });

    await POST(request);

    await capturedOnFinish?.({
      responseMessage: {
        id: "assistant-invalid-source",
        role: "assistant",
        parts: [{ type: "text", text: "typed default response" }],
      },
      isAborted: false,
      finishReason: "stop",
    });

    expect(trackAssistantTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        promptSource: "typed",
      }),
    );
  });

  it("does not track telemetry when assistant persistence fails", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    fetchProfileMock.mockResolvedValue({
      profile: { data_sharing_consent: true },
    });
    persistAssistantMessageMock.mockRejectedValueOnce(
      new Error("assistant persist failed"),
    );

    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            id: "m-user",
            role: "user",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
        "x-ff-conversation-id": "76a2ace1-3165-4d5d-9552-c864ac08f130",
      },
    });

    await POST(request);

    await capturedOnFinish?.({
      responseMessage: {
        id: "assistant-fail",
        role: "assistant",
        parts: [{ type: "text", text: "response" }],
      },
      isAborted: false,
      finishReason: "stop",
    });

    expect(trackAssistantTurnMock).not.toHaveBeenCalled();
  });
});
