import type { UIMessage } from "ai";

import { createClient } from "@/supabase/server";

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

  const lastUserText = getLastUserText(messages);
  // Ensure conversation exists (idempotent)
  await supabase.from("conversations").upsert(
    {
      id: conversationId,
      user_id: user.id,
      title: (lastUserText || "Conversation").slice(0, 240),
    },
    { onConflict: "id" },
  );

  if (!lastUserText) return;

  // Save user message
  await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: lastUserText,
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
  content: string;
  model?: string;
  usageTokens?: number;
}): Promise<void> {
  const {
    conversationId,
    content,
    model = "gpt-4o-mini",
    usageTokens,
  } = params;

  if (!content.trim()) return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return;

  await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "assistant",
    content,
    model,
    usage_tokens: usageTokens ?? null,
  });

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", user.id);
}
