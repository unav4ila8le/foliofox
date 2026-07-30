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
    // flex-1 + min-h-0: the conversation scroller hides its content height
    // from layout (that's what makes internal scrolling work), so a
    // content-sized card collapses to the header + composer once a
    // conversation is active. Fill the available height instead.
    // contain-size: without it the chat's content height propagates up as the
    // layout wrapper's min-content, making the whole shell scroll instead of
    // capping the card at the available height.
    <div className="bg-primary-foreground mx-auto grid min-h-0 w-full max-w-3xl flex-1 overflow-hidden rounded-lg border contain-size">
      <AIChatPanel
        layoutMode="page"
        isAIEnabled={profile.data_sharing_consent}
        initialConversationId={requestedConversationId}
        moveToSidebarHref={moveToSidebarHref}
      />
    </div>
  );
}
