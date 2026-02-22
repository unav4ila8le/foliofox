"use client";

import { AIChatPanel } from "@/components/dashboard/ai-chat/panel";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import { useSidebar } from "@/components/ui/custom/sidebar";

export function AIAdvisor() {
  const { profile } = useDashboardData();
  const { rightWidth } = useSidebar();

  return (
    <AIChatPanel
      isAIEnabled={profile.data_sharing_consent}
      historyPopoverWidth={`calc(${rightWidth} - 16px)`}
      expandHref="/dashboard/ai-chat"
    />
  );
}
