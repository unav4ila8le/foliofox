"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle, Info } from "lucide-react";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { YahooFinanceLogo } from "@/components/ui/logos/yahoo-finance-logo";
import { SymbolSearch } from "../symbol-search";
import { AssetCategorySelector } from "@/components/dashboard/asset-category-selector";

import { useNewHoldingDialog } from "../index";

import { requiredNumberWithConstraints } from "@/lib/zod-helpers";

import { fetchYahooFinanceSymbol } from "@/server/symbols/search";
import { fetchSingleQuote } from "@/server/quotes/fetch";
import { createHolding } from "@/server/holdings/create";

import { getCategoryFromQuoteType } from "@/lib/asset-category-mappings";

const formSchema = z.object({
  symbol_id: z.string().min(1, { error: "Symbol is required." }),
  name: z
    .string()
    .min(3, { error: "Name must be at least 3 characters." })
    .max(64, { error: "Name must not exceed 64 characters." }),
  category_code: z.string().min(1, { error: "Category is required." }),
  currency: z.string().length(3),
  unit_value: requiredNumberWithConstraints("Unit value is required.", {
    gte: { value: 0, error: "Value must be 0 or greater" },
  }),
  quantity: requiredNumberWithConstraints("Quantity is required.", {
    gte: { value: 0, error: "Quantity must be 0 or greater" },
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

export function SymbolSearchForm() {
  // Props destructuring and context hooks
  const { setOpen } = useNewHoldingDialog();

  // State declarations
  const [isLoading, setIsLoading] = useState(false);

  // Form setup and derived state
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      symbol_id: "",
      name: "",
      category_code: "",
      currency: "",
      unit_value: "",
      quantity: "",
      cost_basis_per_unit: "",
      description: "",
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Watch field changes
  const symbolId = form.watch("symbol_id") || "";

  // Handle symbol selection from dropdown
  const handleSymbolSelect = async (symbolId: string) => {
    try {
      // 1. Fetch the symbol quote details
      const yahooFinanceSymbol = await fetchYahooFinanceSymbol(symbolId);
      if (!yahooFinanceSymbol.success || !yahooFinanceSymbol.data) {
        throw new Error(
          yahooFinanceSymbol.message || "Failed to fetch symbol details",
        );
      }

      // 2. Fetch the price for today without upsert
      const unitValue = await fetchSingleQuote(symbolId, { upsert: false });

      // 3. Auto-fill form fields
      const symbolData = yahooFinanceSymbol.data;

      // Category
      const category = getCategoryFromQuoteType(symbolData.quote_type || "");
      if (category) {
        form.setValue("category_code", category);
      }

      // Currency
      if (symbolData.currency) {
        form.setValue("currency", symbolData.currency);
      }

      // Unit value
      form.setValue("unit_value", unitValue);

      // Name
      const displayName = symbolData.long_name || symbolData.short_name;
      form.setValue("name", `${symbolId} - ${displayName}`);
    } catch (error) {
      console.warn(
        "Error selecting symbol:",
        error instanceof Error ? error.message : error,
      );
      toast.error(
        error instanceof Error ? error.message : "Error selecting symbol.",
      );

      // Clear form if any error occurs to force user to re-select
      form.reset();
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

      const result = await createHolding(formData);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Holding created successfully");
      form.reset(); // Clear form
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
  const isFormReady = Boolean(symbolId);

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
                    If omitted, we’ll use the unit value as your initial cost
                    basis.
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
                  placeholder="Add a description of this holding"
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
            onClick={() => setOpen(false)}
            disabled={isLoading}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={isLoading || !isDirty || !isFormReady}
            type="submit"
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
