import { Sparkles } from "lucide-react";

import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  StickyDialogContent,
  StickyDialogHeader,
} from "@/components/ui/custom/sticky-dialog";
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
      <StickyDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <StickyDialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" /> Foliofox AI Advisor
          </DialogTitle>
          <DialogDescription>
            Update your AI settings and data sharing preferences here.
          </DialogDescription>
        </StickyDialogHeader>
        <AISettingsForm onSuccess={() => onOpenChange(false)} />
      </StickyDialogContent>
    </Dialog>
  );
}
