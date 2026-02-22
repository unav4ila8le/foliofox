"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PanelRightClose } from "lucide-react";

import { AIChatPanel } from "@/components/dashboard/ai-chat/panel";
import { sanitizeDashboardReturnPath } from "@/components/dashboard/ai-chat/navigation";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import { Button } from "@/components/ui/button";

export default function AIChatPage() {
  const searchParams = useSearchParams();
  const { profile } = useDashboardData();

  const requestedConversationId = searchParams.get("conversationId");
  const requestedReturnPath = searchParams.get("from");
  const moveToSidebarHref =
    sanitizeDashboardReturnPath(requestedReturnPath) ?? "/dashboard";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden">
      <div className="flex items-center justify-between pb-2">
        <h1 className="text-2xl font-semibold">AI Advisor</h1>
        <Button size="xs" variant="secondary" asChild>
          <Link href={moveToSidebarHref}>
            <PanelRightClose /> Move to sidebar
          </Link>
        </Button>
      </div>
      <div className="bg-card min-h-0 flex-1 overflow-hidden rounded-lg border">
        <AIChatPanel
          isAIEnabled={profile.data_sharing_consent}
          initialConversationId={requestedConversationId}
        />
      </div>
    </div>
  );
}
