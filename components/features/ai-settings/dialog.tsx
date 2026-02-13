import { Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { AISettingsForm } from "./form";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISettingsDialog({
  open,
  onOpenChange,
}: AISettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" /> Foliofox AI Advisor
          </DialogTitle>
          <DialogDescription>
            Update your AI settings and data sharing preferences here.
          </DialogDescription>
        </DialogHeader>
        <AISettingsForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
