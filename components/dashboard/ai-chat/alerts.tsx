import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { ChatAlertsProps } from "./types";

export function ChatAlerts({
  showProactiveCapAlert,
  isCapError,
  chatErrorMessage,
  maxConversations,
}: ChatAlertsProps) {
  if (!showProactiveCapAlert && !chatErrorMessage) {
    return null;
  }

  return (
    <div className="px-4 pb-2">
      <Alert
        variant={
          showProactiveCapAlert || isCapError ? "default" : "destructive"
        }
      >
        <TriangleAlert />
        <AlertTitle>
          {showProactiveCapAlert || isCapError
            ? "Conversation limit reached"
            : "Chat request failed"}
        </AlertTitle>
        <AlertDescription>
          {showProactiveCapAlert
            ? `You have ${maxConversations} saved conversations. Delete an older conversation from history to start a new one.`
            : chatErrorMessage}
        </AlertDescription>
      </Alert>
    </div>
  );
}
