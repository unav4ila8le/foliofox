"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Controller } from "react-hook-form";
import type {
  Control,
  FieldPath,
  FieldValues,
  UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LocalizedNumberInput } from "@/components/custom/localized-number-input";
import { formatNumber } from "@/lib/number-format";
import { useLocale } from "@/hooks/use-locale";

const CAPITAL_GAINS_TAX_RATE_PRESETS = [12.5, 26] as const;

interface CapitalGainsTaxRateFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  setValue: UseFormSetValue<TFieldValues>;
  name?: FieldPath<TFieldValues>;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function CapitalGainsTaxRateField<TFieldValues extends FieldValues>({
  control,
  setValue,
  name,
  className,
  disabled = false,
  placeholder,
}: CapitalGainsTaxRateFieldProps<TFieldValues>) {
  const locale = useLocale();
  const fieldName = (name ??
    "capital_gains_tax_rate") as FieldPath<TFieldValues>;
  const resolvedPlaceholder = useMemo(
    () => placeholder ?? `E.g., ${formatNumber(26, { locale })}`,
    [locale, placeholder],
  );

  return (
    <Controller
      control={control}
      name={fieldName}
      render={({ field, fieldState }) => {
        const hasInputValue =
          field.value != null && String(field.value).trim() !== "";

        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            <div className="flex items-center gap-1">
              <FieldLabel htmlFor={field.name}>
                Capital gains tax rate (optional)
              </FieldLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-4" aria-label="Tax rate help" />
                </TooltipTrigger>
                <TooltipContent>
                  Enter a percentage from 0 to 100. We apply tax only to
                  positive unrealized gains.
                </TooltipContent>
              </Tooltip>
            </div>
            <InputGroup>
              <LocalizedNumberInput
                mode="input-group-input"
                id={field.name}
                placeholder={resolvedPlaceholder}
                min={0}
                max={100}
                disabled={disabled}
                aria-invalid={fieldState.invalid}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={(field.value as string | number | null) ?? ""}
                onValueChange={(nextValue) => field.onChange(nextValue)}
              />
              {!hasInputValue ? (
                <InputGroupAddon align="inline-end">
                  <div className="flex items-center gap-1">
                    {CAPITAL_GAINS_TAX_RATE_PRESETS.map((presetRate) => (
                      <Button
                        key={presetRate}
                        type="button"
                        disabled={disabled}
                        variant="secondary"
                        size="xs"
                        className="rounded-full"
                        onClick={() => {
                          setValue(
                            fieldName,
                            String(
                              presetRate,
                            ) as TFieldValues[FieldPath<TFieldValues>],
                            {
                              shouldDirty: true,
                              shouldValidate: true,
                            },
                          );
                        }}
                      >
                        {formatNumber(presetRate, { locale })}
                      </Button>
                    ))}
                  </div>
                </InputGroupAddon>
              ) : null}
              <InputGroupAddon align="inline-end">%</InputGroupAddon>
            </InputGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        );
      }}
    />
  );
}
