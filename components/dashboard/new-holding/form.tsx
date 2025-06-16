"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

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
import { YahooFinanceLogo } from "@/components/ui/logos/yahoo-finance-logo";
import { SymbolSearch } from "@/components/dashboard/symbol-search";
import { AssetCategorySelector } from "@/components/dashboard/asset-category-selector";
import { CurrencySelector } from "@/components/dashboard/currency-selector";

import { useNewHoldingDialog } from "./index";

import { createHolding } from "@/server/holdings/create";

import {
  shouldShowSymbolSearch,
  getQuoteTypesForCategory,
} from "@/lib/asset-category-mappings";

const formSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters.")
    .max(64, "Name must not exceed 64 characters."),
  category_code: z.string().min(1, "Category is required"),
  symbol_id: z.string(),
  currency: z.string().length(3),
  current_unit_value: z.coerce.number().gt(0, "Value must be greater than 0"),
  current_quantity: z.coerce.number().gt(0, "Quantity must be greater than 0"),
  description: z
    .string()
    .max(256, {
      message: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function NewHoldingForm() {
  const { setOpen, profile } = useNewHoldingDialog();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category_code: "",
      symbol_id: "",
      currency: profile.display_currency,
      current_unit_value: 0,
      current_quantity: 0,
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
      formData.append("category_code", values.category_code);
      formData.append("currency", values.currency);
      formData.append(
        "current_unit_value",
        values.current_unit_value.toString(),
      );
      formData.append("current_quantity", values.current_quantity.toString());
      formData.append("description", values.description || "");

      const result = await createHolding(formData);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Holding created successfully");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create a new holding",
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
                  placeholder="E.g., Chase Savings, Rental Property, Bitcoin Holdings"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <AssetCategorySelector field={field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {shouldShowSymbolSearch(form.watch("category_code")) && (
          <FormField
            control={form.control}
            name="symbol_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center justify-between gap-2">
                  Symbol
                  <YahooFinanceLogo height={16} />
                </FormLabel>
                <FormControl>
                  <SymbolSearch
                    field={field}
                    quoteTypes={getQuoteTypesForCategory(
                      form.watch("category_code"),
                    )}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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
          <FormField
            control={form.control}
            name="current_unit_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current unit value</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g., 420.69"
                    type="number"
                    {...field}
                    value={field.value === 0 ? "" : field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="current_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current quantity</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g., 10"
                    type="number"
                    {...field}
                    value={field.value === 0 ? "" : field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add a description of this holding"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => setOpen(false)}
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
                <LoaderCircle className="animate-spin" />
                Saving...
              </>
            ) : (
              "Add holding"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
