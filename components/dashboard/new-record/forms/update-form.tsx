"use client";

import { useEffect, useState, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Info } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Spinner } from "@/components/ui/spinner";

import { useNewRecordDialog } from "../index";

import { cn } from "@/lib/utils";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";

import { createTransaction } from "@/server/transactions/create";
import { fetchSingleQuote } from "@/server/quotes/fetch";

import type { TransformedHolding } from "@/types/global.types";

// Form validation schema using Zod
const formSchema = z.object({
  date: z.date({ error: "A date is required." }),
  quantity: requiredNumberWithConstraints("Quantity is required.", {
    gte: { value: 0, error: "Quantity must be 0 or greater." },
  }),
  unit_value: requiredNumberWithConstraints("Unit value is required.", {
    gte: { value: 0, error: "Value must be 0 or greater." },
  }),
  cost_basis_per_unit: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value.trim() === "" ||
        !Number.isNaN(Number(value)),
      { error: "Cost basis per unit must be a number" },
    )
    .refine(
      (value) =>
        value === undefined || value.trim() === "" || Number(value) > 0,
      { error: "Cost basis per unit must be greater than 0" },
    ),
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function UpdateForm() {
  // Get dialog context (preselected holding and close function)
  const { setOpen, preselectedHolding } = useNewRecordDialog();

  // Local state for loading and quote fetching
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);

  // Check if current holding has a symbol (for automatic price fetching)
  const hasSymbol = !!preselectedHolding?.symbol_id;

  // Initialize form with React Hook Form
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      quantity: preselectedHolding?.current_quantity || "",
      unit_value: preselectedHolding?.current_unit_value || "",
      cost_basis_per_unit: "",
      description: "",
    },
  });

  // Get form state for validation
  const { isDirty } = form.formState;

  // Fetch current market price (quote) for symbol-based holdings
  const fetchQuoteForHolding = useCallback(
    async (holding: TransformedHolding, date: Date) => {
      if (!holding.symbol_id) return;

      setIsFetchingQuote(true);
      try {
        const quote = await fetchSingleQuote(holding.symbol_id, {
          date: date,
          upsert: false, // Don't cache this quote
        });

        // Update the unit value field with current market price
        form.setValue("unit_value", quote);
      } catch (error) {
        console.error("Error fetching quote:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to fetch current price",
        );
      } finally {
        setIsFetchingQuote(false);
      }
    },
    [form],
  );

  // Pre-populate form when holding is selected
  useEffect(() => {
    if (preselectedHolding) {
      // Reset form first, then set new values
      form.reset({
        date: new Date(),
        quantity: preselectedHolding.current_quantity || "",
        unit_value: preselectedHolding.current_unit_value || "",
        description: "",
      });

      if (preselectedHolding.symbol_id) {
        fetchQuoteForHolding(preselectedHolding, new Date());
      }
    }
  }, [preselectedHolding, form, fetchQuoteForHolding]);

  // Re-fetch quote when date changes (for historical prices)
  const watchedDate = form.watch("date");
  useEffect(() => {
    if (preselectedHolding?.symbol_id && watchedDate) {
      fetchQuoteForHolding(preselectedHolding, watchedDate);
    }
  }, [watchedDate, preselectedHolding, fetchQuoteForHolding]);

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!preselectedHolding) {
      toast.error("No holding selected!");
      return;
    }

    setIsLoading(true);

    try {
      // Prepare form data for server action
      const formData = new FormData();
      formData.append("type", "update"); // Transaction type
      formData.append("holding_id", preselectedHolding.id);
      formData.append("date", format(values.date, "yyyy-MM-dd"));
      formData.append("quantity", values.quantity.toString());
      formData.append("unit_value", values.unit_value.toString());

      // Only add description if provided
      if (values.description) {
        formData.append("description", values.description);
      }

      // Only add cost basis per unit if provided
      if (values.cost_basis_per_unit) {
        formData.append(
          "cost_basis_per_unit",
          values.cost_basis_per_unit.toString(),
        );
      }

      // Create transaction using server action
      const result = await createTransaction(formData);

      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Record created successfully");
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create record. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-x-2 gap-y-4"
      >
        {/* Date picker field */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="sm:w-1/2 sm:pr-1">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "text-left font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Unit value and quantity fields in a grid */}
        <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
          {/* Quantity field */}
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
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

          {/* Unit value field */}
          <FormField
            control={form.control}
            name="unit_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit value</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g., 420.69"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    disabled={hasSymbol} // Disabled for market assets (auto-filled)
                    {...field}
                    value={field.value as number}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Optional cost basis per unit */}
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
                    Enter your average price paid per unit at this date. Used
                    for P/L. If omitted, we infer it from previous records or
                    from the unit value.
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

        {/* Optional description field */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add any notes about this update"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action buttons */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setOpen(false)}
            disabled={isLoading || isFetchingQuote}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isFetchingQuote || !isDirty}
          >
            {isLoading ? (
              <>
                <Spinner />
                Creating...
              </>
            ) : (
              "Create record"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
