import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
          <DialogTitle>Foliofox AI Advisor</DialogTitle>
          <DialogDescription>
            Update your AI settings and data sharing preferences here.
          </DialogDescription>
        </DialogHeader>
        <AISettingsForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
