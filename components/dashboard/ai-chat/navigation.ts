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

  let normalizedPathWithSearch: string;
  let normalizedPathname: string;

  try {
    const normalizedUrl = new URL(from, "https://foliofox.local");
    normalizedPathname = normalizedUrl.pathname;
    normalizedPathWithSearch = `${normalizedUrl.pathname}${normalizedUrl.search}`;
  } catch {
    return null;
  }

  if (!normalizedPathname.startsWith("/dashboard")) {
    return null;
  }

  if (
    normalizedPathname === AI_CHAT_ROUTE ||
    normalizedPathname.startsWith(`${AI_CHAT_ROUTE}/`)
  ) {
    return null;
  }

  return normalizedPathWithSearch;
}
