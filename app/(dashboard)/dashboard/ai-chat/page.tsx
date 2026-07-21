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
      {/* Single-cell grid: the panel stretches to the card, while the card
          stays content-sized between the min-height floor and available space. */}
      <div className="bg-primary-foreground mx-auto grid min-h-[min(70dvh,100%)] w-full max-w-3xl overflow-hidden rounded-lg border">
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
