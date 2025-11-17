import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FinancialProfileForm } from "./form";

import type { FinancialProfile, Profile } from "@/types/global.types";

interface FinancialProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  financialProfile?: FinancialProfile | null;
}

export function FinancialProfileDialog({
  open,
  onOpenChange,
  profile,
  financialProfile,
}: FinancialProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[calc(100dvh-1rem)] md:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Financial profile</DialogTitle>
          <DialogDescription>
            Update this form to help Foliofox AI Advisor understand your
            financial situation and respond with more relevant guidance.
          </DialogDescription>
        </DialogHeader>
        <FinancialProfileForm
          profile={profile}
          financialProfile={financialProfile}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
