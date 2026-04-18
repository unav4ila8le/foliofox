import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { SettingsForm } from "./account/form";

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
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Update your profile details and automated email preferences here.
          </DialogDescription>
        </DialogHeader>
        <SettingsForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
