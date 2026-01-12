import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FinancialProfileForm } from "./form";

interface FinancialProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FinancialProfileDialog({
  open,
  onOpenChange,
}: FinancialProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[calc(100dvh-1rem)] overflow-y-auto md:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Financial profile</DialogTitle>
          <DialogDescription>
            Update this form to help Foliofox AI Advisor understand your
            financial situation and respond with more relevant guidance.
          </DialogDescription>
        </DialogHeader>
        <FinancialProfileForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
