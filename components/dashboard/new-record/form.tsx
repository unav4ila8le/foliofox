"use client";

import { useEffect, useState } from "react";
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

import type { Holding } from "@/types/global.types";

const formSchema = z.object({
  date: z.date({
    required_error: "A date is required.",
  }),
  holding_id: z.string({
    required_error: "Please select a holding.",
  }),
  quantity: z.coerce.number().gt(0, "Quantity must be greater than 0"),
  value: z.coerce.number().gt(0, "Value must be greater than 0"),
  description: z
    .string()
    .max(256, {
      message: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function NewRecordForm() {
  const { setOpen, preselectedHolding } = useNewRecordDialog();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(
    preselectedHolding,
  );

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      holding_id: preselectedHolding?.id || "",
      quantity: 0,
      value: 0,
      description: "",
    },
  });

  // Pre-populate values when a holding is selected
  useEffect(() => {
    if (selectedHolding) {
      // Only update if fields are empty or if it's a different holding
      const currentHoldingId = form.getValues("holding_id");
      if (currentHoldingId === selectedHolding.id) {
        form.setValue("quantity", selectedHolding.current_quantity || 0);
        form.setValue("value", selectedHolding.current_value || 0);
      }
    }
  }, [selectedHolding, form]);

  // Handle holding selection from dropdown
  const handleHoldingSelect = (holding: Holding | null) => {
    setSelectedHolding(holding);
  };

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("type", "update");
      formData.append("holding_id", values.holding_id);
      formData.append("date", values.date.toISOString());
      formData.append("quantity", values.quantity.toString());
      formData.append("value", values.value.toString());
      formData.append("description", values.description || "");

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
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Value</FormLabel>
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
                    value={field.value === 0 ? "" : field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
            type="submit"
            disabled={isLoading || !isDirty}
            className="w-1/2 sm:w-auto"
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
