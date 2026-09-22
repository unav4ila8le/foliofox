"use client";

import { toast } from "sonner";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { DialogClose } from "@/components/ui/custom/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";

import { upsertFinancialProfile } from "@/server/financial-profiles/actions";

import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import {
  AboutField,
  AgeBandField,
  IncomeFields,
  RiskPreferenceField,
} from "./fields";
import {
  financialProfileFormSchema,
  toFinancialProfileFormData,
  type FinancialProfileFormValues,
} from "./schema";

interface FinancialProfileFormProps {
  onSuccess?: () => void;
}

export function FinancialProfileForm({ onSuccess }: FinancialProfileFormProps) {
  const { profile, financialProfile } = useDashboardData();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form with React Hook Form
  const form = useForm({
    resolver: zodResolver(financialProfileFormSchema),
    defaultValues: {
      age_band: financialProfile?.age_band ?? null,
      income_amount: financialProfile?.income_amount ?? null,
      income_currency:
        financialProfile?.income_currency ?? profile.display_currency,
      risk_preference: financialProfile?.risk_preference ?? null,
      about: financialProfile?.about ?? null,
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Submit handler
  async function onSubmit(values: FinancialProfileFormValues) {
    setIsLoading(true);
    try {
      const result = await upsertFinancialProfile(
        toFinancialProfileFormData(values),
      );

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Financial profile updated successfully");

      // Close the dialog
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update financial profile",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogBody>
        <div className="grid gap-6">
          <AgeBandField control={form.control} />
          <IncomeFields control={form.control} />
          <RiskPreferenceField control={form.control} />
          <AboutField control={form.control} />
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={isLoading} type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={isLoading || !isDirty} type="submit">
          {isLoading ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
