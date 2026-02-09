import type { UIMessage } from "ai";

import { chatModelId } from "@/server/ai/provider";
import {
  MAX_CONVERSATIONS_PER_USER,
  MAX_PERSISTED_MESSAGES_PER_CONVERSATION,
} from "@/lib/ai/chat-guardrails-config";

import { createClient } from "@/supabase/server";
import { Json } from "@/types/database.types";
import {
  AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE,
  AI_CHAT_ERROR_CODES,
} from "@/lib/ai/chat-errors";

type TextPart = { type: "text"; text: string };
type ConversationRole = "assistant" | "user" | "system" | "tool";

/**
 * Normalized persistence error with a stable code the route can map to HTTP responses.
 */
export class AIChatPersistenceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AIChatPersistenceError";
  }
}

function getLastUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const parts =
    lastUser?.parts.filter(
      (part): part is TextPart =>
        part.type === "text" && typeof part.text === "string",
    ) ?? [];
  return parts
    .map((p) => p.text)
    .join("\n")
    .trim();
}

async function getNextMessageOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
): Promise<number> {
  // TODO(paywall): Make message ordering atomic via DB sequence or unique
  // constraint on (conversation_id, order) + conflict retry strategy.
  const { data } = await supabase
    .from("conversation_messages")
    .select("order")
    .eq("conversation_id", conversationId)
    .order("order", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.order ?? -1) + 1;
}

async function getAuthenticatedUserAndClient() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  return { supabase, user };
}

async function countUserConversations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to count conversations: ${error.message}`);
  }

  return count ?? 0;
}

async function createConversationWithGuardrails(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  conversationId: string;
  title: string;
}) {
  const { supabase, userId, conversationId, title } = params;

  // Server-side cap guard: block creation once user hits the configured max.
  // TODO(paywall): Make this atomic with either:
  // 1) DB-level trigger/check enforcement, or
  // 2) an atomic insert strategy that only inserts when count < cap.
  const conversationCount = await countUserConversations(supabase, userId);

  if (conversationCount >= MAX_CONVERSATIONS_PER_USER) {
    throw new AIChatPersistenceError(
      AI_CHAT_ERROR_CODES.conversationCapReached,
      AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE,
    );
  }

  const { error } = await supabase.from("conversations").insert({
    id: conversationId,
    user_id: userId,
    title: title.slice(0, 240),
  });

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }
}

async function ensureConversationExists(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  conversationId: string;
  title: string;
}) {
  const { supabase, userId, conversationId, title } = params;
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch conversation: ${error.message}`);
  }

  if (data) {
    return;
  }

  // Create only when missing so existing threads can continue past cap.
  await createConversationWithGuardrails({
    supabase,
    userId,
    conversationId,
    title,
  });
}

async function touchConversation(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  conversationId: string;
  userId: string;
}) {
  const { supabase, conversationId, userId } = params;
  const { error } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      `Failed to update conversation timestamp: ${error.message}`,
    );
  }
}

async function trimConversationMessages(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  conversationId: string;
  userId: string;
}) {
  const { supabase, conversationId, userId } = params;

  const { count, error: countError } = await supabase
    .from("conversation_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (countError) {
    throw new Error(
      `Failed to count conversation messages: ${countError.message}`,
    );
  }

  const totalCount = count ?? 0;
  if (totalCount <= MAX_PERSISTED_MESSAGES_PER_CONVERSATION) {
    return;
  }

  // Delete oldest rows first to keep only the newest bounded history.
  const overflowCount = totalCount - MAX_PERSISTED_MESSAGES_PER_CONVERSATION;
  const { data: staleRows, error: staleRowsError } = await supabase
    .from("conversation_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(overflowCount);

  if (staleRowsError) {
    throw new Error(
      `Failed to fetch stale messages: ${staleRowsError.message}`,
    );
  }

  const staleIds = (staleRows ?? []).map((row) => row.id);
  if (staleIds.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("conversation_messages")
    .delete()
    .in("id", staleIds);

  if (deleteError) {
    throw new Error(
      `Failed to trim conversation messages: ${deleteError.message}`,
    );
  }
}

async function insertConversationMessage(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  conversationId: string;
  userId: string;
  role: ConversationRole;
  content: string;
  parts: UIMessage["parts"];
  model: string;
  usageTokens?: number;
}) {
  const {
    supabase,
    conversationId,
    userId,
    role,
    content,
    parts,
    model,
    usageTokens,
  } = params;
  const messageOrder = await getNextMessageOrder(supabase, conversationId);

  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role,
    content,
    parts: parts as Json,
    order: messageOrder,
    model,
    usage_tokens: usageTokens,
  });

  if (error) {
    throw new Error(`Failed to persist conversation message: ${error.message}`);
  }
}

/**
 * Persists the latest user turn for a conversation and enforces rolling trim.
 */
export async function persistConversationFromMessages(params: {
  conversationId: string;
  messages: UIMessage[];
  model?: string;
}): Promise<void> {
  const { conversationId, messages, model = chatModelId } = params;

  const { supabase, user } = await getAuthenticatedUserAndClient();
  if (!user) return;

  const lastUiMessage = messages.at(-1);

  if (!lastUiMessage) return;
  // Only persist user turns in this path.
  if (lastUiMessage.role !== "user") return;

  const lastUserText = getLastUserText(messages) || "Conversation";

  await ensureConversationExists({
    supabase,
    userId: user.id,
    conversationId,
    title: lastUserText,
  });

  await insertConversationMessage({
    supabase,
    conversationId,
    userId: user.id,
    role: "user",
    content: lastUserText,
    parts: lastUiMessage.parts,
    model,
  });

  await touchConversation({ supabase, conversationId, userId: user.id });
  await trimConversationMessages({ supabase, conversationId, userId: user.id });
}

/**
 * Removes the latest assistant turn so regenerate can replace it cleanly.
 */
export async function prepareConversationForRegenerate(params: {
  conversationId: string;
}): Promise<void> {
  const { conversationId } = params;
  const { supabase, user } = await getAuthenticatedUserAndClient();
  if (!user) return;

  const { data: latestAssistantMessage, error: fetchError } = await supabase
    .from("conversation_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .eq("role", "assistant")
    .order("order", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error(
      `Failed to fetch latest assistant message: ${fetchError.message}`,
    );
  }

  if (!latestAssistantMessage) {
    return;
  }

  // Regenerate replaces the latest assistant response instead of appending.
  const { error: deleteError } = await supabase
    .from("conversation_messages")
    .delete()
    .eq("id", latestAssistantMessage.id)
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(
      `Failed to prepare conversation regenerate: ${deleteError.message}`,
    );
  }

  await touchConversation({ supabase, conversationId, userId: user.id });
}

/**
 * Persists a single assistant turn from stream onFinish and enforces rolling trim.
 */
export async function persistAssistantMessage(params: {
  conversationId: string;
  message: UIMessage;
  model?: string;
  usageTokens?: number;
}): Promise<void> {
  const { conversationId, message, model = chatModelId, usageTokens } = params;

  // Assistant-only persistence path from stream onFinish.
  if (message.role !== "assistant") return;

  const { supabase, user } = await getAuthenticatedUserAndClient();
  if (!user) return;

  await insertConversationMessage({
    supabase,
    conversationId,
    userId: user.id,
    role: "assistant",
    content: extractTextContent(message.parts),
    parts: message.parts,
    model,
    usageTokens,
  });

  await touchConversation({ supabase, conversationId, userId: user.id });
  await trimConversationMessages({ supabase, conversationId, userId: user.id });
}

export function extractTextContent(parts: UIMessage["parts"]): string {
  if (!Array.isArray(parts)) return "";

  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}
