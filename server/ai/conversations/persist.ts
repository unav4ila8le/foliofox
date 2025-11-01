import type { UIMessage } from "ai";

import { createClient } from "@/supabase/server";
import { Json } from "@/types/database.types";

type TextPart = { type: "text"; text: string };

function getLastUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const parts =
    lastUser?.parts.filter(
      (p): p is TextPart =>
        (p as { type?: string }).type === "text" &&
        typeof (p as { text?: unknown }).text === "string",
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
  const { data } = await supabase
    .from("conversation_messages")
    .select("message_order")
    .eq("conversation_id", conversationId)
    .order("message_order", { ascending: false })
    .limit(1)
    .single();

  return (data?.message_order ?? -1) + 1;
}

export async function persistConversationFromMessages(params: {
  conversationId: string;
  messages: UIMessage[];
  model?: string;
}): Promise<void> {
  const { conversationId, messages, model = "gpt-4o-mini" } = params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return;

  const lastUserText = getLastUserText(messages) || "Conversation";
  // Ensure conversation exists (idempotent)
  await supabase.from("conversations").upsert(
    {
      id: conversationId,
      user_id: user.id,
      title: lastUserText.slice(0, 240),
    },
    { onConflict: "id" },
  );

  const lastUiMessage = messages.at(-1);

  if (!lastUiMessage) return;

  const messageOrder = await getNextMessageOrder(supabase, conversationId);

  await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: lastUserText,
    parts: lastUiMessage.parts as Json,
    message_order: messageOrder,
    model,
  });

  // Bump conversation.updated_at (kept in server logic)
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", user.id);
}

export async function persistAssistantMessage(params: {
  conversationId: string;
  messages: UIMessage[];
  model?: string;
  usageTokens?: number;
}): Promise<void> {
  const {
    conversationId,
    messages,
    model = "gpt-4o-mini",
    usageTokens,
  } = params;

  if (messages.length === 0) return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return;

  const baseOrder = await getNextMessageOrder(supabase, conversationId);

  const rows = messages.map((message, index) => ({
    conversation_id: conversationId,
    user_id: user.id,
    role: message.role as "assistant" | "user" | "system" | "tool",
    content: extractTextContent(message.parts),
    parts: message.parts as Json,
    message_order: baseOrder + index,
    model,
    usage_tokens: usageTokens,
  }));

  await supabase.from("conversation_messages").insert(rows);

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", user.id);
}

export function extractTextContent(parts: UIMessage["parts"]): string {
  if (!Array.isArray(parts)) return "";

  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}
