"use client";

import { toast } from "sonner";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PositionCategorySelector } from "@/components/dashboard/position-category-selector";
import { CapitalGainsTaxRateField } from "@/components/dashboard/positions/shared/capital-gains-tax-rate-field";

import { updatePosition } from "@/server/positions/update";

import {
  capitalGainsTaxRatePercentSchema,
  formatCapitalGainsTaxRatePercent,
  parseCapitalGainsTaxRatePercent,
} from "@/lib/capital-gains-tax-rate";
import type { Position } from "@/types/global.types";

interface UpdatePositionFormProps {
  position: Position;
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

export function UpdatePositionForm({
  position,
  onSuccess,
}: UpdatePositionFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: position.name,
      category_id: position.category_id,
      capital_gains_tax_rate: formatCapitalGainsTaxRatePercent(
        position.capital_gains_tax_rate,
      ),
      description: position.description ?? undefined,
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

      toast.success("Position updated successfully");

      // Close the dialog
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update position",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="E.g., Chase Savings, Rental Property, Bitcoin Position"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <PositionCategorySelector field={field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add a description for this position"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <CapitalGainsTaxRateField
          control={form.control}
          setValue={form.setValue}
          disabled={isLoading}
        />

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
    </Form>
  );
}
