"use client";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type EnableSharingProps = {
  onEnable: () => Promise<void> | void;
  isEnabling?: boolean;
};

export function EnableSharing({
  onEnable,
  isEnabling = false,
}: EnableSharingProps) {
  return (
    <div className="space-y-4">
      <Alert>
        <Info />
        <AlertTitle>Enable public sharing</AlertTitle>
        <AlertDescription>
          This will generate a public link. It will stay active for 24 hours.
          You can change the expiration date or disable it at any time.
        </AlertDescription>
      </Alert>

      <Button className="w-full" disabled={isEnabling} onClick={onEnable}>
        {isEnabling ? (
          <>
            <Spinner /> Enabling...
          </>
        ) : (
          "Enable sharing"
        )}
      </Button>
    </div>
  );
}
