import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
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
        className="md:max-w-2xl"
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
