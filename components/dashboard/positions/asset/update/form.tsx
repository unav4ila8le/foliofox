"use client";

import { toast } from "sonner";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PositionCategorySelector } from "@/components/dashboard/position-category-selector";
import { CapitalGainsTaxRateField } from "@/components/dashboard/positions/shared/capital-gains-tax-rate-field";
import { UpdateSymbolDialog } from "@/components/dashboard/positions/shared/update-symbol-dialog";

import { updatePosition } from "@/server/positions/update";

import {
  capitalGainsTaxRatePercentSchema,
  formatCapitalGainsTaxRatePercent,
  parseCapitalGainsTaxRatePercent,
} from "@/lib/capital-gains-tax-rate";
import type { Position } from "@/types/global.types";

interface UpdateAssetFormProps {
  position: Position;
  currentSymbolTicker?: string;
  onSuccess?: () => void;
}

const formSchema = z.object({
  name: z
    .string()
    .min(3, { error: "Name must be at least 3 characters." })
    .max(64, { error: "Name must not exceed 64 characters." }),
  category_id: z.string().min(1, { error: "Category is required." }),
  capital_gains_tax_rate: capitalGainsTaxRatePercentSchema,
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function UpdateAssetForm({
  position,
  currentSymbolTicker,
  onSuccess,
}: UpdateAssetFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [updateSymbolDialogOpen, setUpdateSymbolDialogOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: position.name,
      category_id: position.category_id,
      capital_gains_tax_rate: formatCapitalGainsTaxRatePercent(
        position.capital_gains_tax_rate,
      ),
      description: position.description ?? "",
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
      formData.append("description", values.description || "");
      const capitalGainsTaxRate = parseCapitalGainsTaxRatePercent(
        values.capital_gains_tax_rate,
      );
      formData.append(
        "capital_gains_tax_rate",
        capitalGainsTaxRate != null ? capitalGainsTaxRate.toString() : "",
      );

      const result = await updatePosition(formData, position.id);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Asset updated successfully");

      // Close the dialog
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update asset",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        {/* Name */}
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                id={field.name}
                placeholder="E.g., Chase Savings, Rental Property, Bitcoin Holdings"
                aria-invalid={fieldState.invalid}
                {...field}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
                isInvalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Capital gains tax rate */}
        <CapitalGainsTaxRateField
          control={form.control}
          setValue={form.setValue}
          disabled={isLoading}
          className="sm:w-1/2"
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
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Advanced */}
        {currentSymbolTicker && (
          <Accordion type="single" collapsible>
            <AccordionItem value="advanced">
              <AccordionTrigger className="text-muted-foreground justify-start gap-1 text-sm">
                Advanced
              </AccordionTrigger>
              <AccordionContent>
                <div className="bg-muted/50 space-y-3 rounded-lg border p-4">
                  <div className="space-y-1 text-sm">
                    <h4 className="flex items-center gap-2 font-medium">
                      Change Ticker Symbol
                    </h4>
                    <p className="text-muted-foreground">
                      Update the market data symbol linked to this position.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUpdateSymbolDialogOpen(true)}
                  >
                    Change Symbol
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={onSuccess}
            disabled={isLoading}
            type="button"
            variant="secondary"
            className="w-1/2 sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            disabled={isLoading || !isDirty}
            type="submit"
            className="w-1/2 sm:w-auto"
          >
            {isLoading ? (
              <>
                <Spinner />
                Updating...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>

      <UpdateSymbolDialog
        open={updateSymbolDialogOpen}
        onOpenChangeAction={setUpdateSymbolDialogOpen}
        positionId={position.id}
        currentSymbolTicker={currentSymbolTicker}
      />
    </>
  );
}
