import { Sparkles } from "lucide-react";
import { useState } from "react";

import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { AISettingsDialog } from "@/components/features/ai-settings/dialog";
import { Button } from "@/components/ui/button";
import { Logomark } from "@/components/ui/logos/logomark";

export function DisabledState() {
  const [openAISettings, setOpenAISettings] = useState(false);

  return (
    <div className="p-4 text-center">
      <ConversationEmptyState
        icon={<Logomark width={64} className="text-muted-foreground/25" />}
        title="Foliofox AI Advisor"
        description="Share your portfolio and financial profile to get tailored portfolio insights and advice."
        className="p-0 pb-3"
      />
      <p className="text-muted-foreground mb-2 text-sm">
        Turn on AI data sharing in settings to unlock personalized answers.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpenAISettings(true)}
      >
        <Sparkles /> Enable data sharing
      </Button>
      <AISettingsDialog
        open={openAISettings}
        onOpenChange={setOpenAISettings}
      />
    </div>
  );
}
