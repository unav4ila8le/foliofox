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
import { SymbolSearch } from "../symbol-search";
import { AssetCategorySelector } from "@/components/dashboard/asset-category-selector";

import { useNewHoldingDialog } from "../index";
import { useCurrencies } from "@/hooks/client/use-currencies";

import { createHolding } from "@/server/holdings/create";
import { createSymbol } from "@/server/symbols/create";
import { fetchSingleQuote } from "@/server/quotes/fetch";

import { getCategoryFromQuoteType } from "@/lib/asset-category-mappings";

import type { Symbol } from "@/types/global.types";

const formSchema = z.object({
  symbol_id: z.string().min(1, { error: "Symbol is required." }),
  name: z
    .string()
    .min(3, { error: "Name must be at least 3 characters." })
    .max(64, { error: "Name must not exceed 64 characters." }),
  category_code: z.string().min(1, { error: "Category is required." }),
  currency: z.string().length(3),
  unit_value: z.coerce.number().gte(0, { error: "Value must be 0 or greater" }),
  quantity: z.coerce
    .number()
    .gte(0, { error: "Quantity must be 0 or greater" }),
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function SymbolSearchForm() {
  // Props destructuring and context hooks
  const { setOpen, profile } = useNewHoldingDialog();
  const { currencies } = useCurrencies();

  // State declarations
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<Symbol | null>(null);

  // Form setup and derived state
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      symbol_id: "",
      name: "",
      category_code: "",
      currency: profile.display_currency,
      unit_value: 0,
      quantity: 0,
      description: "",
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Watch field changes
  const symbolId = form.watch("symbol_id") || "";

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

      // 3. Fetch the historical price for today (or most recent trading day)
      const unitValue = await fetchSingleQuote(symbol.id);

      if (!symbolData?.currency || !unitValue) {
        throw new Error(
          "Currency or historical price is missing from quote data.",
        );
      }

      // 4. Check if currency is supported by database
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

      // 5. Auto-fill category based on quote type
      const category = getCategoryFromQuoteType(symbolData.quote_type);
      if (category) {
        form.setValue("category_code", category);
      }

      // 6. Auto-fill other fields
      form.setValue("currency", symbolData.currency);
      form.setValue("unit_value", unitValue);

      // Set name
      const displayName = symbolData?.long_name || symbolData?.short_name;
      form.setValue("name", `${symbol.id} - ${displayName}`);

      // Store selected symbol for reference
      setSelectedSymbol(symbolData);
    } catch (error) {
      console.error("Error fetching quote data:", error);

      toast.error(
        error instanceof Error ? error.message : "Error fetching quote data.",
      );

      // Clear symbol_id if error occurs to force user to re-select
      form.setValue("symbol_id", "");
      setSelectedSymbol(null);
    }
  };

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("symbol_id", values.symbol_id);
      formData.append("name", values.name);
      formData.append("category_code", values.category_code);
      formData.append("currency", values.currency);
      formData.append("unit_value", values.unit_value.toString());
      formData.append("quantity", values.quantity.toString());

      if (values.description) {
        formData.append("description", values.description);
      }

      const result = await createHolding(formData);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Holding created successfully");
      form.reset(); // Clear form
      setSelectedSymbol(null); // Clear symbol state
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

  // Check if form is ready (symbol selected)
  const isFormReady = Boolean(symbolId && selectedSymbol);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        {/* Symbol */}
        <FormField
          control={form.control}
          name="symbol_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between gap-2">
                Symbol
                <YahooFinanceLogo height={14} />
              </FormLabel>
              <FormControl>
                <SymbolSearch
                  field={field}
                  onSymbolSelect={handleSymbolSelect}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="E.g., AAPL - Apple Inc."
                  disabled={!isFormReady}
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
          name="category_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <AssetCategorySelector field={field} disabled={!isFormReady} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quantity */}
        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem className="sm:w-1/2 sm:pr-1">
              <FormLabel>Current quantity</FormLabel>
              <FormControl>
                <Input
                  placeholder="E.g., 10"
                  type="number"
                  {...field}
                  value={
                    field.value === 0 ? "" : (field.value as number | string)
                  }
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
                  placeholder="Add a description of this holding"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action buttons */}
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
            disabled={isLoading || !isDirty || !isFormReady}
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
