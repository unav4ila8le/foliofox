import { beforeEach, describe, expect, it, vi } from "vitest";

const streamTextMock = vi.fn();
const convertToModelMessagesMock = vi.fn(async (messages) => messages);
const stepCountIsMock = vi.fn(() => "stop-condition");
const buildGuardrailedModelContextMock = vi.fn((messages) => messages);
const fetchProfileMock = vi.fn();
const persistConversationFromMessagesMock = vi.fn();
const persistAssistantMessageMock = vi.fn();
const createSystemPromptMock = vi.fn(() => "system prompt");

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
    }) => Promise<void>)
  | undefined;

vi.mock("ai", () => ({
  streamText: streamTextMock,
  convertToModelMessages: convertToModelMessagesMock,
  stepCountIs: stepCountIsMock,
}));

vi.mock("@/server/profile/actions", () => ({
  fetchProfile: fetchProfileMock,
}));

vi.mock("@/server/ai/system-prompt", () => ({
  createSystemPrompt: createSystemPromptMock,
}));

vi.mock("@/server/ai/tools", () => ({
  aiTools: {},
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

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    capturedOnFinish = undefined;
    streamTextMock.mockReset();
    convertToModelMessagesMock.mockClear();
    stepCountIsMock.mockClear();
    buildGuardrailedModelContextMock.mockClear();
    fetchProfileMock.mockReset();
    persistConversationFromMessagesMock.mockReset();
    persistAssistantMessageMock.mockReset();
    createSystemPromptMock.mockClear();

    streamTextMock.mockReturnValue({
      totalUsage: Promise.resolve({ totalTokens: 222 }),
      toUIMessageStreamResponse: ({
        onFinish,
      }: {
        onFinish: (params: {
          responseMessage: unknown;
          isAborted: boolean;
        }) => Promise<void>;
      }) => {
        capturedOnFinish = onFinish;
        return new Response("ok", { status: 200 });
      },
    });
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
    });
  });
});
