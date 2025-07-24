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
import { useCurrencies } from "@/hooks/client/use-currencies";

import { createHolding } from "@/server/holdings/create";
import { createSymbol } from "@/server/symbols/create";
import { fetchSingleQuote } from "@/server/quotes/fetch";

import {
  shouldShowSymbolSearch,
  shouldHideQuantity,
  getQuoteTypesForCategory,
} from "@/lib/asset-category-mappings";

import type { Symbol } from "@/types/global.types";

const formSchema = z.object({
  category_code: z.string().min(1, { error: "Category is required." }),
  name: z
    .string()
    .min(3, { error: "Name must be at least 3 characters." })
    .max(64, { error: "Name must not exceed 64 characters." }),
  symbol_id: z.string(),
  currency: z.string().length(3),
  unit_value: z.coerce
    .number()
    .gt(0, { error: "Value must be greater than 0" }),
  quantity: z.coerce
    .number()
    .gt(0, { error: "Quantity must be greater than 0" }),
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function NewHoldingForm() {
  // Props destructuring and context hooks
  const { setOpen, profile } = useNewHoldingDialog();
  const { currencies } = useCurrencies();

  // State declarations
  const [isLoading, setIsLoading] = useState(false);

  // Form setup and derived state
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

  // Watch category changes
  const categoryCode = form.watch("category_code") || "";

  // Clear symbol_id when switching to a category that doesn't support symbols
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

  // Handle symbol selection from dropdown
  const handleSymbolSelect = async (symbol: Symbol) => {
    try {
      // 1. Create symbol
      const symbolResult = await createSymbol(symbol.id);
      if (!symbolResult.success) {
        throw new Error(symbolResult.message);
      }

      // 2. Use the returned symbol data directly
      const symbolData = symbolResult.data;

      // 3. Fetch the historical price (adjClose/close) for today (or most recent trading day)
      const unitValue = await fetchSingleQuote(symbol.id);

      if (!symbolData?.currency || !unitValue) {
        throw new Error(
          "Currency or historical price is missing from quote data.",
        );
      }

      // 4. Check if currency is supported using existing currencies list
      const isCurrencySupported = currencies.some(
        (currency) => currency.alphabetic_code === symbolData.currency,
      );

      if (!isCurrencySupported) {
        toast.error(
          `Currency ${symbolData.currency} is not supported yet. Please contact us to add this currency or select a different symbol.`,
        );
        form.setValue("symbol_id", "");
        return;
      }

      // 5. Auto-populate with quote data
      form.setValue("currency", symbolData.currency);
      form.setValue("unit_value", unitValue);

      // Set name if not already filled
      if (!form.getValues("name")) {
        const displayName = symbolData?.long_name || symbolData?.short_name;
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

      // Only append description if it exists
      if (values.description) {
        formData.append("description", values.description);
      }

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
        {shouldShowSymbolSearch(categoryCode) && (
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
                    quoteTypes={getQuoteTypesForCategory(categoryCode)}
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
        {!shouldShowSymbolSearch(categoryCode) && (
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
          {!shouldShowSymbolSearch(categoryCode) && (
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
                      value={
                        field.value === 0
                          ? ""
                          : (field.value as number | string)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {!shouldHideQuantity(categoryCode) && (
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
                      value={
                        field.value === 0
                          ? ""
                          : (field.value as number | string)
                      }
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
