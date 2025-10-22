"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";

import { useNewPortfolioRecordDialog } from "../index";

import { cn } from "@/lib/utils";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";

import { fetchRecordBoundaryDate } from "@/server/portfolio-records/boundary";
import { createPortfolioRecord } from "@/server/portfolio-records/create";

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

export function BuyForm() {
  // Get dialog context (preselected position and close function)
  const { setOpen, preselectedPosition } = useNewPortfolioRecordDialog();

  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [minDate, setMinDate] = useState<Date | null>(null);

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

  // Fetch the boundary date for the position
  useEffect(() => {
    if (!preselectedPosition) return;
    const fetchBoundary = async () => {
      const boundary = await fetchRecordBoundaryDate(preselectedPosition.id);
      setMinDate(boundary ? new Date(boundary) : null);
    };
    fetchBoundary();
  }, [preselectedPosition]);

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
      formData.append("type", "buy");
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
          : "Failed to create buy transaction. Please try again.",
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
        {/* Date */}
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
                      date > new Date() ||
                      date < (minDate ?? new Date("1900-01-01"))
                    }
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quantity and unit value fields in a grid */}
        <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
          {/* Quantity field */}
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity purchased</FormLabel>
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
                <FormLabel>Purchase price per unit</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g., 420.69"
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
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add any notes about this purchase"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setOpen(false)}
            disabled={isLoading}
            type="button"
            variant="secondary"
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
        </div>
      </form>
    </Form>
  );
}
