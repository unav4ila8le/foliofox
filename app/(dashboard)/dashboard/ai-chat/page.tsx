import { PanelRightClose } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AIChatPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* AI Advisor Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">AI Advisor</h1>
          <Button size="xs" variant="secondary">
            <PanelRightClose /> Move to sidebar
          </Button>
        </div>
      </div>
    </div>
  );
}
