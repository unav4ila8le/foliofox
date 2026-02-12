import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  StickyDialogContent,
  StickyDialogHeader,
} from "@/components/ui/custom/sticky-dialog";
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
      <StickyDialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="md:max-w-2xl"
      >
        <StickyDialogHeader>
          <DialogTitle>Financial profile</DialogTitle>
          <DialogDescription>
            Update this form to help Foliofox AI Advisor understand your
            financial situation and respond with more relevant guidance.
          </DialogDescription>
        </StickyDialogHeader>
        <FinancialProfileForm onSuccess={() => onOpenChange(false)} />
      </StickyDialogContent>
    </Dialog>
  );
}
