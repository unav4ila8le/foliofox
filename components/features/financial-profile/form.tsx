"use client";

import { toast } from "sonner";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  StickyDialogBody,
  StickyDialogFooter,
} from "@/components/ui/custom/sticky-dialog";
import { CurrencySelector } from "@/components/dashboard/currency-selector";

import { upsertFinancialProfile } from "@/server/financial-profiles/actions";

import { AGE_BANDS, RISK_PREFERENCES } from "@/types/enums";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";

const RISK_PREFERENCES_DESCRIPTIONS = {
  [RISK_PREFERENCES[0]]: "Focus on preserving capital with minimal volatility.",
  [RISK_PREFERENCES[1]]: "Prefer lower risk with steady, predictable returns.",
  [RISK_PREFERENCES[2]]: "Balanced approach between risk and stability.",
  [RISK_PREFERENCES[3]]:
    "Comfortable with higher risk for potentially higher long-term returns.",
  [RISK_PREFERENCES[4]]:
    "Seeks maximum growth with potential for significant volatility.",
};

interface FinancialProfileFormProps {
  onSuccess?: () => void;
}

// Form validation schema using Zod
const formSchema = z.object({
  age_band: z.enum(AGE_BANDS).nullable().optional(),
  income_amount: z
    .preprocess((value) => {
      if (value === "" || value === null || value === undefined) return null;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }, z.number().nonnegative().nullable())
    .optional(),
  income_currency: z.string().trim().length(3).nullable().optional(),
  risk_preference: z.enum(RISK_PREFERENCES).nullable().optional(),
  about: z
    .string()
    .trim()
    .max(2000, { error: "About text must be no more than 2000 characters" })
    .nullable()
    .optional(),
});

export function FinancialProfileForm({ onSuccess }: FinancialProfileFormProps) {
  const { profile, financialProfile } = useDashboardData();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form with React Hook Form
  const form = useForm({
    resolver: zodResolver(formSchema),
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
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      // Prepare form data for server action
      const formData = new FormData();
      formData.append("age_band", values.age_band ?? "");
      formData.append("income_amount", values.income_amount?.toString() ?? "");
      formData.append("income_currency", values.income_currency ?? "");
      formData.append("risk_preference", values.risk_preference ?? "");
      formData.append("about", values.about ?? "");

      const result = await upsertFinancialProfile(formData);

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
      <StickyDialogBody>
        <div className="grid gap-6">
          {/* Age band */}
          <Controller
            control={form.control}
            name="age_band"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Age</FieldLabel>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="grid grid-cols-2 gap-2 md:grid-cols-3"
                >
                  {AGE_BANDS.map((band) => (
                    <Label
                      htmlFor={`age-${band}`}
                      key={band}
                      className="hover:bg-primary/5 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 flex gap-3 rounded-md border p-3 shadow-xs"
                    >
                      <RadioGroupItem value={band} id={`age-${band}`} />
                      <p>{band}</p>
                    </Label>
                  ))}
                </RadioGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid items-start gap-x-2 gap-y-4 md:grid-cols-5">
            {/* Income amount */}
            <Controller
              control={form.control}
              name="income_amount"
              render={({ field, fieldState }) => (
                <Field
                  data-invalid={fieldState.invalid}
                  className="md:col-span-3"
                >
                  <FieldLabel htmlFor={field.name}>Yearly income</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={field.name}
                      placeholder="E.g., 80,000"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      aria-invalid={fieldState.invalid}
                      {...field}
                      value={(field.value as number) ?? ""}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>
                        {form.watch("income_currency")}
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Income currency */}
            <Controller
              control={form.control}
              name="income_currency"
              render={({ field, fieldState }) => (
                <Field
                  data-invalid={fieldState.invalid}
                  className="md:col-span-2"
                >
                  <FieldLabel htmlFor={field.name}>Income currency</FieldLabel>
                  <CurrencySelector
                    field={{
                      value: field.value ?? "USD",
                      onChange: field.onChange,
                    }}
                    isInvalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          {/* Risk preference */}
          <Controller
            control={form.control}
            name="risk_preference"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Risk preference</FieldLabel>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {RISK_PREFERENCES.map((preference) => (
                    <Label
                      htmlFor={`risk-${preference}`}
                      key={preference}
                      className="hover:bg-primary/5 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 flex items-start gap-3 rounded-md border p-3 shadow-xs"
                    >
                      <RadioGroupItem
                        value={preference}
                        id={`risk-${preference}`}
                      />
                      <div className="space-y-1.5">
                        <p className="capitalize">
                          {preference.replaceAll("_", " ")}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {RISK_PREFERENCES_DESCRIPTIONS[preference]}
                        </p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </Field>
            )}
          />

          {/* About */}
          <Controller
            control={form.control}
            name="about"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  What should the AI know about you?
                </FieldLabel>
                <Textarea
                  id={field.name}
                  placeholder="E.g., saving for a home, avoiding crypto, big purchase soon, etc."
                  aria-invalid={fieldState.invalid}
                  {...field}
                  value={field.value ?? ""}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
                <FieldDescription>
                  Describe any personal preferences, constraints, or context the
                  AI should consider when running financial analysis, generating
                  insights, or explaining decisions.
                </FieldDescription>
              </Field>
            )}
          />
        </div>
      </StickyDialogBody>

      <StickyDialogFooter>
        <DialogClose asChild>
          <Button
            disabled={isLoading}
            type="button"
            variant="outline"
            className="w-1/2 sm:w-auto"
          >
            Cancel
          </Button>
        </DialogClose>
        <Button
          disabled={isLoading || !isDirty}
          type="submit"
          className="w-1/2 sm:w-auto"
        >
          {isLoading ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </StickyDialogFooter>
    </form>
  );
}
