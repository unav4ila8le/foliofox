"use client";

import { useEffect, useState, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Info } from "lucide-react";
import { toast } from "sonner";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

import { useNewPortfolioRecordDialog } from "../index";

import { cn } from "@/lib/utils";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";

import { createPortfolioRecord } from "@/server/portfolio-records/create";
import { fetchSingleQuote } from "@/server/quotes/fetch";

import type { TransformedPosition } from "@/types/global.types";

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
  // Get dialog context (preselected position and close function)
  const { setOpen, preselectedPosition } = useNewPortfolioRecordDialog();

  // Local state for loading and quote fetching
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);

  // Check if current position has a symbol (for automatic price fetching)
  const hasSymbol = !!preselectedPosition?.symbol_id;

  // Initialize form with React Hook Form
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      quantity: preselectedPosition?.current_quantity || "",
      unit_value: preselectedPosition?.current_unit_value || "",
      cost_basis_per_unit: "",
      description: "",
    },
  });

  // Get form state for validation
  const { isDirty } = form.formState;

  // Fetch current market price (quote) for symbol-based positions
  const fetchQuoteForPosition = useCallback(
    async (position: TransformedPosition, date: Date) => {
      if (!position.symbol_id) return;

      setIsFetchingQuote(true);
      try {
        const quote = await fetchSingleQuote(position.symbol_id, {
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

  // Pre-populate form when position is selected
  useEffect(() => {
    if (preselectedPosition) {
      // Reset form first, then set new values
      form.reset({
        date: new Date(),
        quantity: preselectedPosition.current_quantity || "",
        unit_value: preselectedPosition.current_unit_value || "",
        description: "",
      });

      if (preselectedPosition.symbol_id) {
        fetchQuoteForPosition(preselectedPosition, new Date());
      }
    }
  }, [preselectedPosition, form, fetchQuoteForPosition]);

  // Re-fetch quote when date changes (for historical prices)
  const watchedDate = form.watch("date");
  useEffect(() => {
    if (preselectedPosition?.symbol_id && watchedDate) {
      fetchQuoteForPosition(preselectedPosition, watchedDate);
    }
  }, [watchedDate, preselectedPosition, fetchQuoteForPosition]);

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!preselectedPosition) {
      toast.error("No position selected!");
      return;
    }

    setIsLoading(true);

    try {
      // Prepare form data for server action
      const formData = new FormData();
      formData.append("type", "update"); // Transaction type
      formData.append("position_id", preselectedPosition.id);
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

      // Create portfolio record using server action
      const result = await createPortfolioRecord(formData);

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
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogBody>
        <div className="grid gap-x-2 gap-y-4">
          {/* Date picker field */}
          <Controller
            control={form.control}
            name="date"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="sm:w-1/2 sm:pr-1"
              >
                <FieldLabel htmlFor={field.name}>Date</FieldLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id={field.name}
                      variant="outline"
                      aria-invalid={fieldState.invalid}
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
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Unit value and quantity fields in a grid */}
          <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
            {/* Quantity field */}
            <Controller
              control={form.control}
              name="quantity"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Quantity</FieldLabel>
                  <Input
                    id={field.name}
                    placeholder="E.g., 10"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    aria-invalid={fieldState.invalid}
                    {...field}
                    value={field.value as number}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Unit value field */}
            <Controller
              control={form.control}
              name="unit_value"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Unit value</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={field.name}
                      placeholder="E.g., 420.69"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      disabled={hasSymbol} // Disabled for market assets (auto-filled)
                      aria-invalid={fieldState.invalid}
                      {...field}
                      value={field.value as number}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>
                        {preselectedPosition?.currency || "N/A"}
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          {/* Optional cost basis per unit */}
          <Controller
            control={form.control}
            name="cost_basis_per_unit"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="sm:w-1/2 sm:pr-1"
              >
                <div className="flex items-center gap-1">
                  <FieldLabel htmlFor={field.name}>
                    Cost basis per unit (optional)
                  </FieldLabel>
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
                <Input
                  id={field.name}
                  placeholder="E.g., 12.41"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  aria-invalid={fieldState.invalid}
                  {...field}
                  value={field.value}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Optional description field */}
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Description (optional)
                </FieldLabel>
                <Input
                  id={field.name}
                  placeholder="Add any notes about this update"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      </DialogBody>

      {/* Action buttons */}
      <DialogFooter>
        <Button
          onClick={() => setOpen(false)}
          disabled={isLoading || isFetchingQuote}
          type="button"
          variant="outline"
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
      </DialogFooter>
    </form>
  );
}
