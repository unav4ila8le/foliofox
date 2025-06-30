"use client";

import { useState, useEffect } from "react";
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
import { SymbolSearch } from "@/components/dashboard/new-holding/symbol-search";
import { AssetCategorySelector } from "@/components/dashboard/asset-category-selector";
import { CurrencySelector } from "@/components/dashboard/currency-selector";

import { useNewHoldingDialog } from "./index";

import { createHolding } from "@/server/holdings/create";
import { getSymbolQuote } from "@/server/symbols/search";
import { fetchSingleQuote } from "@/server/quotes/fetch";

import {
  shouldShowSymbolSearch,
  shouldHideQuantity,
  getQuoteTypesForCategory,
} from "@/lib/asset-category-mappings";

import type { Symbol } from "@/types/global.types";

const formSchema = z.object({
  category_code: z.string().min(1, "Category is required"),
  name: z
    .string()
    .min(3, "Name must be at least 3 characters.")
    .max(64, "Name must not exceed 64 characters."),
  symbol_id: z.string(),
  currency: z.string().length(3),
  unit_value: z.coerce.number().gt(0, "Value must be greater than 0"),
  quantity: z.coerce.number().gt(0, "Quantity must be greater than 0"),
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
      category_code: "",
      name: "",
      symbol_id: "",
      currency: profile.display_currency,
      unit_value: 0,
      quantity: 0,
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
      formData.append("category_code", values.category_code);
      formData.append("name", values.name);
      formData.append("currency", values.currency);
      formData.append("unit_value", values.unit_value.toString());
      formData.append("quantity", values.quantity.toString());
      formData.append("description", values.description || "");

      // Add symbol_id if it exists and is not empty
      if (values.symbol_id && values.symbol_id.trim() !== "") {
        formData.append("symbol_id", values.symbol_id);
      }

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

  const handleSymbolSelect = async (symbol: Symbol) => {
    try {
      // Get static symbol info
      const quoteResult = await getSymbolQuote(symbol.id);
      if (!quoteResult.success) {
        throw new Error(quoteResult.message || "Error fetching quote data.");
      }
      const quoteData = quoteResult.data;

      // Fetch the historical price (adjClose/close) for today (or most recent trading day)
      const today = new Date();
      const unitValue = await fetchSingleQuote(symbol.id, today);

      if (!quoteData?.currency || !unitValue) {
        throw new Error(
          "Currency or historical price is missing from quote data.",
        );
      }

      // Auto-populate with quote data
      form.setValue("currency", quoteData.currency);
      form.setValue("unit_value", unitValue);

      // Set name if not already filled
      if (!form.getValues("name")) {
        const displayName = quoteData?.longName || quoteData?.shortName;
        form.setValue("name", `${symbol.id} - ${displayName}`);
      }
    } catch (error) {
      console.error("Error fetching quote data:", error);

      toast.error(
        error instanceof Error ? error.message : "Error fetching quote data.",
      );

      // Clear symbol_id if error occurs to force user to re-select
      form.setValue("symbol_id", "");
    }
  };

  // Clear symbol_id when switching to a category that doesn't support symbols
  const categoryCode = form.watch("category_code");
  useEffect(() => {
    if (categoryCode && !shouldShowSymbolSearch(categoryCode)) {
      form.setValue("symbol_id", "");
    }
  }, [categoryCode, form]);

  // Auto-set quantity to 1 for categories that don't support (need) quantity
  useEffect(() => {
    if (categoryCode && shouldHideQuantity(categoryCode)) {
      form.setValue("quantity", 1);
    }
  }, [categoryCode, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
                    onSymbolSelect={handleSymbolSelect}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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
        {!shouldShowSymbolSearch(form.watch("category_code")) && (
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
        )}

        <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
          {!shouldShowSymbolSearch(form.watch("category_code")) && (
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
                      {...field}
                      value={field.value === 0 ? "" : field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {!shouldHideQuantity(form.watch("category_code")) && (
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
                      {...field}
                      value={field.value === 0 ? "" : field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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
