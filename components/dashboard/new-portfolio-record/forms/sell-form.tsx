"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Spinner } from "@/components/ui/spinner";
import {
  StickyDialogBody,
  StickyDialogFooter,
} from "@/components/ui/custom/sticky-dialog";

import { useNewPortfolioRecordDialog } from "../index";

import { cn } from "@/lib/utils";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";

import { createPortfolioRecord } from "@/server/portfolio-records/create";

export function SellForm() {
  // Get dialog context (preselected position and close function)
  const { setOpen, preselectedPosition } = useNewPortfolioRecordDialog();

  // Local state
  const [isLoading, setIsLoading] = useState(false);

  // Create form schema
  const formSchema = z.object({
    date: z.date({ error: "A date is required." }),
    quantity: requiredNumberWithConstraints("Quantity is required.", {
      gt: { value: 0, error: "Quantity must be greater than 0." },
    }),
    unit_value: requiredNumberWithConstraints("Unit value is required.", {
      gt: { value: 0, error: "Value must be greater than 0." },
    }),
    description: z
      .string()
      .max(256, {
        error: "Description must not exceed 256 characters.",
      })
      .optional(),
  });

  // Initialize form with React Hook Form
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      quantity: "",
      unit_value: "",
      description: "",
    },
  });

  // Get form state for validation
  const { isDirty } = form.formState;

  // Handle form submission
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!preselectedPosition) {
      toast.error("No position selected!");
      return;
    }

    setIsLoading(true);

    try {
      // Prepare form data for server action
      const formData = new FormData();
      formData.append("type", "sell"); // Transaction type
      formData.append("position_id", preselectedPosition.id);
      formData.append("date", format(values.date, "yyyy-MM-dd"));
      formData.append("quantity", values.quantity.toString());
      formData.append("unit_value", values.unit_value.toString());

      // Only add description if provided
      if (values.description) {
        formData.append("description", values.description);
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
          : "Failed to create sell transaction. Please try again.",
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
      <StickyDialogBody>
        <div className="grid gap-x-2 gap-y-4">
          {/* Date */}
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

          {/* Quantity and unit value fields in a grid */}
          <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
            {/* Quantity field */}
            <Controller
              control={form.control}
              name="quantity"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Quantity sold</FieldLabel>
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
                  <FieldLabel htmlFor={field.name}>
                    Sale price per unit
                  </FieldLabel>
                  <Input
                    id={field.name}
                    placeholder="E.g., 420.69"
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
          </div>

          {/* Description */}
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
                  placeholder="Add any notes about this sale"
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
      </StickyDialogBody>

      {/* Action */}
      <StickyDialogFooter>
        <Button
          onClick={() => setOpen(false)}
          disabled={isLoading}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !isDirty}>
          {isLoading ? (
            <>
              <Spinner />
              Creating...
            </>
          ) : (
            "Create record"
          )}
        </Button>
      </StickyDialogFooter>
    </form>
  );
}
