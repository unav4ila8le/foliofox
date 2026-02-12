import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
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
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Change here your profile information
          </DialogDescription>
        </DialogHeader>
        <SettingsForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
