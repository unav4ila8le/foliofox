"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
  DialogFooter,
} from "@/components/ui/custom/dialog";
import { Spinner } from "@/components/ui/spinner";

interface SettingsFormShellProps {
  children: ReactNode;
  isLoading: boolean;
  isSubmitDisabled: boolean;
}

export function SettingsFormShell({
  children,
  isLoading,
  isSubmitDisabled,
}: SettingsFormShellProps) {
  return (
    <>
      <DialogBody>{children}</DialogBody>

      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={isLoading} type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={isSubmitDisabled} type="submit">
          {isLoading ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
