"use client";

import { useSearchParams } from "next/navigation";

import { AIChatPanel } from "@/components/dashboard/ai-chat/panel";
import { sanitizeDashboardReturnPath } from "@/components/dashboard/ai-chat/navigation";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";

export default function AIChatPage() {
  const searchParams = useSearchParams();
  const { profile } = useDashboardData();

  const requestedConversationId = searchParams.get("conversationId");
  const requestedReturnPath = searchParams.get("from");
  const moveToSidebarHref =
    sanitizeDashboardReturnPath(requestedReturnPath) ?? "/dashboard";

  return (
    // contain-size: without it the chat's content height propagates up as the
    // layout wrapper's min-content, making the whole shell scroll instead of
    // capping the card at the available height.
    <div className="flex min-h-0 flex-1 flex-col justify-center contain-size">
      {/* Mobile: the card always fills the available height. From md up it is
          content-sized from a 70dvh floor and grows with the conversation
          until flex shrink caps it at the available height. Growth relies on
          the thread using a content-based flex basis (see chat.tsx). */}
      <div className="bg-primary-foreground mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-lg border md:min-h-[min(70dvh,100%)] md:flex-initial">
        <AIChatPanel
          layoutMode="page"
          isAIEnabled={profile.data_sharing_consent}
          initialConversationId={requestedConversationId}
          moveToSidebarHref={moveToSidebarHref}
        />
      </div>
    </div>
  );
}
