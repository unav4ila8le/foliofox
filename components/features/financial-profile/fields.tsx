"use client";

import { useMemo, type ReactNode } from "react";
import { Controller, useWatch, type Control } from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group";
import { LocalizedNumberInput } from "@/components/ui/custom/localized-number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CurrencySelector } from "@/components/dashboard/currency-selector";

import { formatNumber } from "@/lib/number-format";
import { AGE_BANDS, RISK_PREFERENCES } from "@/types/enums";
import { useLocale } from "@/hooks/use-locale";

import type { FinancialProfileFormInput } from "./schema";

const RISK_PREFERENCES_DESCRIPTIONS = {
  [RISK_PREFERENCES[0]]: "Focus on preserving capital with minimal volatility.",
  [RISK_PREFERENCES[1]]: "Prefer lower risk with steady, predictable returns.",
  [RISK_PREFERENCES[2]]: "Balanced approach between risk and stability.",
  [RISK_PREFERENCES[3]]:
    "Comfortable with higher risk for potentially higher long-term returns.",
  [RISK_PREFERENCES[4]]:
    "Seeks maximum growth with potential for significant volatility.",
};

interface FinancialProfileFieldProps {
  control: Control<FinancialProfileFormInput>;
}

export function AgeBandField({ control }: FinancialProfileFieldProps) {
  return (
    <Controller
      control={control}
      name="age_band"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldTitle id={`${field.name}-label`}>Age</FieldTitle>
          <RadioGroup
            onValueChange={field.onChange}
            value={field.value}
            aria-labelledby={`${field.name}-label`}
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
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function IncomeFields({ control }: FinancialProfileFieldProps) {
  const locale = useLocale();
  const incomeCurrency = useWatch({ control, name: "income_currency" });

  const incomePlaceholder = useMemo(
    () => `E.g., ${formatNumber(80000, { locale })}`,
    [locale],
  );

  return (
    <div className="grid items-start gap-x-2 gap-y-4 md:grid-cols-5">
      {/* Income amount */}
      <Controller
        control={control}
        name="income_amount"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="md:col-span-3">
            <FieldLabel htmlFor={field.name}>Yearly income</FieldLabel>
            <InputGroup>
              <LocalizedNumberInput
                mode="input-group-input"
                id={field.name}
                placeholder={incomePlaceholder}
                min={0}
                aria-invalid={fieldState.invalid}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={(field.value as string | number | null) ?? ""}
                onValueChange={(nextValue) =>
                  field.onChange(nextValue === "" ? null : nextValue)
                }
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{incomeCurrency}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {/* Income currency */}
      <Controller
        control={control}
        name="income_currency"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="md:col-span-2">
            <FieldLabel htmlFor={field.name}>Income currency</FieldLabel>
            <CurrencySelector
              field={{
                value: field.value ?? "USD",
                onChange: field.onChange,
              }}
              id={field.name}
              isInvalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </div>
  );
}

export function RiskPreferenceField({ control }: FinancialProfileFieldProps) {
  return (
    <Controller
      control={control}
      name="risk_preference"
      render={({ field }) => (
        <Field>
          <FieldTitle id={`${field.name}-label`}>Risk preference</FieldTitle>
          <RadioGroup
            onValueChange={field.onChange}
            value={field.value}
            aria-labelledby={`${field.name}-label`}
            className="grid gap-2 sm:grid-cols-2"
          >
            {RISK_PREFERENCES.map((preference) => (
              <Label
                htmlFor={`risk-${preference}`}
                key={preference}
                className="hover:bg-primary/5 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 flex items-start gap-3 rounded-md border p-3 shadow-xs"
              >
                <RadioGroupItem value={preference} id={`risk-${preference}`} />
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
  );
}

export function AboutField({
  control,
  label = "What should the AI know about you?",
  description = "Describe any personal preferences, constraints, or context the AI should consider when running financial analysis, generating insights, or explaining decisions.",
  rows,
}: FinancialProfileFieldProps & {
  label?: ReactNode;
  description?: ReactNode;
  /** Minimum visible lines. The textarea still grows past this as you type. */
  rows?: number;
}) {
  return (
    <Controller
      control={control}
      name="about"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Textarea
            id={field.name}
            placeholder="E.g., saving for a home, avoiding crypto, big purchase soon, etc."
            // Textarea sets field-sizing:content, which sizes to the text and
            // ignores `rows`. Raise the floor instead, in the element's own line
            // heights plus its py-2 and border, so it holds at any font size.
            style={
              rows ? { minHeight: `calc(${rows}lh + 1rem + 2px)` } : undefined
            }
            aria-invalid={fieldState.invalid}
            {...field}
            value={field.value ?? ""}
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          <FieldDescription>{description}</FieldDescription>
        </Field>
      )}
    />
  );
}
