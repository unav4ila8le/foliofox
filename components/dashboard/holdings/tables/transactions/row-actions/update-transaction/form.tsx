"use client";

import { toast } from "sonner";
import { CalendarIcon, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

import { cn } from "@/lib/utils";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";
import { getTransactionTypeLabel } from "@/lib/asset-category-mappings";

import { updateTransaction } from "@/server/transactions/update";

import type { Transaction } from "@/types/global.types";

interface UpdateTransactionFormProps {
  transaction: Transaction;
  onSuccess?: () => void;
}

const formSchema = z.object({
  date: z.date({ error: "A date is required." }),
  type: z.enum(["buy", "sell", "update", "deposit", "withdrawal"], {
    error: "A transaction type is required.",
  }),
  quantity: requiredNumberWithConstraints("Quantity is required.", {
    gte: { value: 0, message: "Quantity must be 0 or greater" },
  }),
  unit_value: requiredNumberWithConstraints("Unit value is required.", {
    gte: { value: 0, message: "Value must be 0 or greater" },
  }),
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function UpdateTransactionForm({
  transaction,
  onSuccess,
}: UpdateTransactionFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(transaction.date),
      type: transaction.type,
      quantity: transaction.quantity,
      unit_value: transaction.unit_value,
      description: transaction.description ?? undefined,
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("date", format(values.date, "yyyy-MM-dd"));
      formData.append("type", values.type);
      formData.append("quantity", values.quantity.toString());
      formData.append("unit_value", values.unit_value.toString());
      formData.append("description", values.description || "");

      const result = await updateTransaction(formData, transaction.id);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Transaction updated successfully");

      // Close the dialog
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update transaction",
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

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem className="sm:w-1/2 sm:pr-1">
              <FormLabel>Transaction type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select transaction type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="buy">
                    {getTransactionTypeLabel("buy")}
                  </SelectItem>
                  <SelectItem value="sell">
                    {getTransactionTypeLabel("sell")}
                  </SelectItem>
                  <SelectItem value="update">
                    {getTransactionTypeLabel("update")}
                  </SelectItem>
                  <SelectItem value="deposit">
                    {getTransactionTypeLabel("deposit")}
                  </SelectItem>
                  <SelectItem value="withdrawal">
                    {getTransactionTypeLabel("withdrawal")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
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
                    {...field}
                    value={field.value as number}
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

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add a description of this transaction"
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
            onClick={onSuccess}
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
                Updating...
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
