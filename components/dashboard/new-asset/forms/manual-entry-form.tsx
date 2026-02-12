"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Info } from "lucide-react";
import { toast } from "sonner";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";
import { PositionCategorySelector } from "@/components/dashboard/position-category-selector";
import { CapitalGainsTaxRateField } from "@/components/dashboard/positions/shared/capital-gains-tax-rate-field";
import { CurrencySelector } from "@/components/dashboard/currency-selector";

import { useNewAssetDialog } from "../index";

import {
  capitalGainsTaxRatePercentSchema,
  parseCapitalGainsTaxRatePercent,
} from "@/lib/capital-gains-tax-rate";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";

import { createPosition } from "@/server/positions/create";

const formSchema = z.object({
  name: z
    .string()
    .min(3, { error: "Name must be at least 3 characters." })
    .max(64, { error: "Name must not exceed 64 characters." }),
  category_id: z.string().min(1, { error: "Category is required." }),
  currency: z.string().length(3),
  unit_value: requiredNumberWithConstraints("Unit value is required.", {
    gte: { value: 0, error: "Value must be 0 or greater." },
  }),
  quantity: requiredNumberWithConstraints("Quantity is required.", {
    gte: { value: 0, error: "Quantity must be 0 or greater." },
  }),
  cost_basis_per_unit: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || v.trim() === "" || !Number.isNaN(Number(v)),
      {
        error: "Cost basis per unit must be a number",
      },
    )
    .refine((v) => v === undefined || v.trim() === "" || Number(v) > 0, {
      error: "Cost basis per unit must be greater than 0",
    }),
  capital_gains_tax_rate: capitalGainsTaxRatePercentSchema,
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function ManualEntryForm() {
  // Props destructuring and context hooks
  const { setOpenFormDialog, setOpenSelectionDialog, profile } =
    useNewAssetDialog();

  // State declarations
  const [isLoading, setIsLoading] = useState(false);

  // Form setup and derived state
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category_id: "",
      currency: profile.display_currency,
      unit_value: "",
      quantity: "",
      cost_basis_per_unit: "",
      capital_gains_tax_rate: "",
      description: "",
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("category_id", values.category_id);
      formData.append("currency", values.currency);
      formData.append("unit_value", values.unit_value.toString());
      formData.append("quantity", values.quantity.toString());

      // Only append cost basis per unit if it exists
      if (values.cost_basis_per_unit) {
        formData.append(
          "cost_basis_per_unit",
          values.cost_basis_per_unit.toString(),
        );
      }

      const capitalGainsTaxRate = parseCapitalGainsTaxRatePercent(
        values.capital_gains_tax_rate,
      );
      if (capitalGainsTaxRate != null) {
        formData.append(
          "capital_gains_tax_rate",
          capitalGainsTaxRate.toString(),
        );
      }

      // Only append description if it exists
      if (values.description) {
        formData.append("description", values.description);
      }

      const result = await createPosition(formData);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Asset created successfully");
      form.reset();
      setOpenFormDialog(false);
      setOpenSelectionDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create a new asset",
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
        <div className="grid gap-4">
          {/* Name */}
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  id={field.name}
                  placeholder="E.g., Chase Savings, Kyoto Apartment, Vintage Wine Collection"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Category */}
          <Controller
            control={form.control}
            name="category_id"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Category</FieldLabel>
                <PositionCategorySelector
                  field={field}
                  positionType="asset"
                  isInvalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Currency */}
          <Controller
            control={form.control}
            name="currency"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="sm:w-1/2 sm:pr-1"
              >
                <FieldLabel htmlFor={field.name}>Currency</FieldLabel>
                <CurrencySelector
                  field={field}
                  isInvalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
            {/* Quantity */}
            <Controller
              control={form.control}
              name="quantity"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Current quantity</FieldLabel>
                  <Input
                    id={field.name}
                    placeholder="E.g., 10"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    aria-invalid={fieldState.invalid}
                    {...field}
                    value={field.value as number}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Unit value */}
            <Controller
              control={form.control}
              name="unit_value"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    Current unit value
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={field.name}
                      placeholder="E.g., 420.69"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      aria-invalid={fieldState.invalid}
                      {...field}
                      value={field.value as number}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{form.watch("currency")}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          {/* Cost basis per unit */}
          <Controller
            control={form.control}
            name="cost_basis_per_unit"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="sm:w-1/2 sm:pr-1"
              >
                <div className="flex items-center gap-1">
                  <FieldLabel htmlFor={field.name}>
                    Cost basis per unit (optional)
                  </FieldLabel>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-4" aria-label="Cost basis help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      If omitted, we&apos;ll use the unit value as your initial
                      cost basis.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id={field.name}
                  placeholder="E.g., 12.41"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  aria-invalid={fieldState.invalid}
                  {...field}
                  value={field.value}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Capital gains tax rate */}
          <CapitalGainsTaxRateField
            control={form.control}
            setValue={form.setValue}
            disabled={isLoading}
          />

          {/* Description */}
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Description (optional)
                </FieldLabel>
                <Input
                  id={field.name}
                  placeholder="Add a description of this asset"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      </DialogBody>

      {/* Footer - Action buttons */}
      <DialogFooter>
        <Button
          onClick={() => setOpenFormDialog(false)}
          disabled={isLoading}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button disabled={isLoading || !isDirty} type="submit">
          {isLoading ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            "Add Asset"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
