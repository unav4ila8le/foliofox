import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  StickyDialogContent,
  StickyDialogHeader,
} from "@/components/ui/custom/sticky-dialog";
import { SettingsForm } from "./form";

import type { Profile } from "@/types/global.types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: Profile;
  email?: string;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <StickyDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <StickyDialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Change here your profile information
          </DialogDescription>
        </StickyDialogHeader>
        <SettingsForm onSuccess={() => onOpenChange(false)} />
      </StickyDialogContent>
    </Dialog>
  );
}
