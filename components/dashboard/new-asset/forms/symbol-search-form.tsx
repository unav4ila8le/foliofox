"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { YahooFinanceLogo } from "@/components/ui/logos/yahoo-finance-logo";
import { SymbolSearch } from "../../symbol-search";
import { PositionCategorySelector } from "@/components/dashboard/position-category-selector";
import { CapitalGainsTaxRateField } from "@/components/dashboard/positions/shared/capital-gains-tax-rate-field";

import { useNewAssetDialog } from "../index";

import {
  capitalGainsTaxRatePercentSchema,
  parseCapitalGainsTaxRatePercent,
} from "@/lib/capital-gains-tax-rate";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";

import { fetchYahooFinanceSymbol } from "@/server/symbols/search";
import { createPosition } from "@/server/positions/create";

import { getPositionCategoryKeyFromQuoteType } from "@/lib/position-category-mappings";

const formSchema = z.object({
  symbolLookup: z.string().min(1, { error: "Symbol is required." }),
  name: z
    .string()
    .min(3, { error: "Name must be at least 3 characters." })
    .max(64, { error: "Name must not exceed 64 characters." }),
  category_id: z.string().min(1, { error: "Category is required." }),
  currency: z.string().length(3),
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
  capital_gains_tax_rate: capitalGainsTaxRatePercentSchema,
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function SymbolSearchForm() {
  // Props destructuring and context hooks
  const { setOpenFormDialog, setOpenSelectionDialog } = useNewAssetDialog();

  // State declarations
  const [isLoading, setIsLoading] = useState(false);

  // Form setup and derived state
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      symbolLookup: "",
      name: "",
      category_id: "",
      currency: "",
      quantity: "",
      cost_basis_per_unit: "",
      capital_gains_tax_rate: "",
      description: "",
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Watch field changes
  const symbolLookup = form.watch("symbolLookup") || "";

  // Handle symbol selection from dropdown
  const handleSymbolSelect = async (symbolLookup: string) => {
    try {
      // 1. Fetch the symbol quote details
      const yahooFinanceSymbol = await fetchYahooFinanceSymbol(symbolLookup);
      if (!yahooFinanceSymbol.success || !yahooFinanceSymbol.data) {
        throw new Error(
          yahooFinanceSymbol.message || "Failed to fetch symbol details",
        );
      }

      // 2. Auto-fill form fields
      const symbolData = yahooFinanceSymbol.data;

      // Category
      const categoryKey = getPositionCategoryKeyFromQuoteType(
        symbolData.quote_type || "",
      );
      if (categoryKey) {
        form.setValue("category_id", categoryKey);
      }

      // Currency
      if (symbolData.currency) {
        form.setValue("currency", symbolData.currency);
      }

      // Name
      const displayName = symbolData.long_name || symbolData.short_name;
      form.setValue("name", `${symbolLookup} - ${displayName}`);
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
      formData.append("symbolLookup", values.symbolLookup);
      formData.append("name", values.name);
      formData.append("category_id", values.category_id);
      formData.append("currency", values.currency);
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
      form.reset(); // Clear form
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

  // Check if form is ready (symbol selected)
  const isFormReady = Boolean(symbolLookup);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        {/* Symbol */}
        <FormField
          control={form.control}
          name="symbolLookup"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between gap-2">
                Symbol
                <Link
                  href="https://finance.yahoo.com/lookup/"
                  target="_blank"
                  aria-label="Go to Yahoo Finance website"
                >
                  <YahooFinanceLogo height={14} />
                </Link>
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
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <PositionCategorySelector
                  field={field}
                  positionType="asset"
                  disabled={!isFormReady}
                />
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

        {/* Capital gains tax rate */}
        <CapitalGainsTaxRateField
          control={form.control}
          setValue={form.setValue}
          disabled={!isFormReady || isLoading}
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
          <Button
            disabled={isLoading || !isDirty || !isFormReady}
            type="submit"
          >
            {isLoading ? (
              <>
                <Spinner />
                Saving...
              </>
            ) : (
              "Add Asset"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
