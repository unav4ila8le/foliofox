export const AI_CHAT_ROUTE = "/dashboard/ai-chat";

interface BuildAIChatExpandHrefParams {
  conversationId: string;
  from: string;
}

export function buildAIChatExpandHref({
  conversationId,
  from,
}: BuildAIChatExpandHrefParams): string {
  const params = new URLSearchParams({
    conversationId,
    from,
  });

  return `${AI_CHAT_ROUTE}?${params.toString()}`;
}

export function sanitizeDashboardReturnPath(
  from: string | null | undefined,
): string | null {
  if (!from) {
    return null;
  }

  if (!from.startsWith("/dashboard")) {
    return null;
  }

  if (from.startsWith(AI_CHAT_ROUTE)) {
    return null;
  }

  return from;
}
