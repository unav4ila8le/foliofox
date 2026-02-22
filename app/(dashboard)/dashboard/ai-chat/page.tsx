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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden">
      <div className="bg-card min-h-0 flex-1 overflow-hidden rounded-lg border">
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
