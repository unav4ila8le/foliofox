"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Info } from "lucide-react";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PositionCategorySelector } from "@/components/dashboard/position-category-selector";
import { CurrencySelector } from "@/components/dashboard/currency-selector";

import { useNewAssetDialog } from "../index";

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="E.g., Chase Savings, Kyoto Apartment, Vintage Wine Collection"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category */}
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <PositionCategorySelector field={field} positionType="asset" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Currency */}
        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem className="sm:w-1/2 sm:pr-1">
              <FormLabel>Currency</FormLabel>
              <FormControl>
                <CurrencySelector field={field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
          {/* Quantity */}
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current quantity</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g., 10"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    {...field}
                    value={field.value as number}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Unit value */}
          <FormField
            control={form.control}
            name="unit_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current unit value</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g., 420.69"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    {...field}
                    value={field.value as number}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Cost basis per unit */}
        <FormField
          control={form.control}
          name="cost_basis_per_unit"
          render={({ field }) => (
            <FormItem className="sm:w-1/2 sm:pr-1">
              <div className="flex items-center gap-1">
                <FormLabel>Cost basis per unit (optional)</FormLabel>
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
              <FormControl>
                <Input
                  placeholder="E.g., 12.41"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  {...field}
                  value={field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add a description of this asset"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Footer - Action buttons */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setOpenFormDialog(false)}
            disabled={isLoading}
            type="button"
            variant="secondary"
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
              "Add asset"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
