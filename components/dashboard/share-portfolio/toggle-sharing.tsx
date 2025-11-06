"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ToggleSharingProps = {
  onEnable: () => Promise<void> | void;
  onDisable: () => Promise<void> | void;
  isActive: boolean;
  isEnabling?: boolean;
  isDisabling?: boolean;
};

export function ToggleSharing({
  onEnable,
  onDisable,
  isActive,
  isEnabling = false,
  isDisabling = false,
}: ToggleSharingProps) {
  const handleToggle = (next: boolean) => {
    if (next === isActive || isEnabling || isDisabling) return;
    if (next) void onEnable();
    else void onDisable();
  };

  return (
    <div className="space-y-2 rounded-lg border px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <Switch
          id="public-sharing"
          checked={isActive}
          disabled={isEnabling || isDisabling}
          onCheckedChange={handleToggle}
          className="data-[state=checked]:bg-green-500"
        />
        <Label htmlFor="public-sharing">Public portfolio sharing</Label>
      </div>
      <p className="text-muted-foreground">
        Your portfolio will be publicly available for 24 hours. You can change
        the expiration date or disable it at any time.
      </p>
    </div>
  );
}
