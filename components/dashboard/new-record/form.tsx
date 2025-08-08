"use client";

import { useEffect, useState, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, LoaderCircle } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";

import { HoldingSelector } from "./holding-selector";
import { useNewRecordDialog } from "./index";

import { cn } from "@/lib/utils";

import { createRecord } from "@/server/records/create";
import { fetchSingleQuote } from "@/server/quotes/fetch";

import type { TransformedHolding } from "@/types/global.types";

const formSchema = z.object({
  date: z.date({ error: "A date is required." }),
  holding_id: z.string().min(1, { error: "Please select a holding." }),
  quantity: z.coerce
    .number()
    .gte(0, { error: "Quantity must be 0 or greater" }),
  unit_value: z.coerce.number().gte(0, { error: "Value must be 0 or greater" }),
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function NewRecordForm() {
  // Props destructuring and context hooks
  const { setOpen, preselectedHolding } = useNewRecordDialog();

  // State declarations
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [selectedHolding, setSelectedHolding] =
    useState<TransformedHolding | null>(preselectedHolding);

  // Determine if holding selector should be shown
  const showHoldingSelector = !preselectedHolding;

  // Check if current holding has a symbol
  const hasSymbol = !!selectedHolding?.symbol_id;

  // Form setup and derived state
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      holding_id: preselectedHolding?.id || "",
      quantity: 0,
      unit_value: 0,
      description: "",
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Fetch quote for symbol-based holdings
  const fetchQuoteForHolding = useCallback(
    async (holding: TransformedHolding, date: Date) => {
      if (!holding.symbol_id) return;

      setIsFetchingQuote(true);
      try {
        const quote = await fetchSingleQuote(holding.symbol_id, date);

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

  // Pre-populate values when a holding is selected
  useEffect(() => {
    if (selectedHolding) {
      form.setValue("quantity", selectedHolding.current_quantity || 0);

      if (selectedHolding.symbol_id) {
        // For symbol-based holdings, fetch the quote
        fetchQuoteForHolding(selectedHolding, form.getValues("date"));
      } else {
        // For non-symbol holdings, use the current unit value
        form.setValue("unit_value", selectedHolding.current_unit_value || 0);
      }
    }
  }, [selectedHolding, form, fetchQuoteForHolding]);

  // Re-fetch quote when date changes for symbol-based holdings
  const watchedDate = form.watch("date");
  useEffect(() => {
    if (selectedHolding?.symbol_id && watchedDate) {
      fetchQuoteForHolding(selectedHolding, watchedDate);
    }
  }, [watchedDate, selectedHolding, fetchQuoteForHolding]);

  // Handle holding selection from dropdown
  const handleHoldingSelect = (holding: TransformedHolding | null) => {
    setSelectedHolding(holding);
  };

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("type", "update");
      formData.append("holding_id", values.holding_id);
      formData.append("date", format(values.date, "yyyy-MM-dd"));
      formData.append("quantity", values.quantity.toString());
      formData.append("unit_value", values.unit_value.toString());

      // Only append description if it exists
      if (values.description) {
        formData.append("description", values.description);
      }

      const result = await createRecord(formData);

      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Holding updated successfully");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update holding. Please try again.",
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
        {/* Date field */}
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

        {/* Holding selector - only show if no preselected holding */}
        {showHoldingSelector && (
          <FormField
            control={form.control}
            name="holding_id"
            render={({ field }) => (
              <FormItem className="sm:w-1/2 sm:pr-1">
                <FormLabel>Holding</FormLabel>
                <FormControl>
                  <HoldingSelector
                    field={field}
                    preselectedHolding={selectedHolding}
                    onHoldingSelect={handleHoldingSelect}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Unit value and quantity fields */}
        <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
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
                    disabled={hasSymbol}
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
        </div>

        {/* Description field */}
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

        {/* Footer - Action buttons */}
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
                <LoaderCircle className="mr-2 animate-spin" />
                Saving...
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
