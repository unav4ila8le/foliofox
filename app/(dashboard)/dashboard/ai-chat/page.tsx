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
    <div className="mx-auto flex h-[calc(100svh-64px-8px-16px)] min-h-0 w-full max-w-3xl flex-col justify-center">
      <div className="bg-card flex min-h-0 flex-col overflow-hidden rounded-lg border">
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
