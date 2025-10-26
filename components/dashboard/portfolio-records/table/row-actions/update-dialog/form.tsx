"use client";

import { toast } from "sonner";
import { CalendarIcon, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

import { cn } from "@/lib/utils";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";

import { updatePortfolioRecord } from "@/server/portfolio-records/update";

import type { PortfolioRecordWithPosition } from "@/types/global.types";

import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";

interface UpdatePortfolioRecordFormProps {
  portfolioRecord: PortfolioRecordWithPosition;
  onSuccess?: () => void;
}

const costBasisSchema = z
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
    (value) => value === undefined || value.trim() === "" || Number(value) > 0,
    { error: "Cost basis per unit must be greater than 0" },
  );

const formSchema = z.object({
  date: z.date({ error: "A date is required." }),
  type: z.enum(PORTFOLIO_RECORD_TYPES, {
    error: "A record type is required.",
  }),
  quantity: requiredNumberWithConstraints("Quantity is required.", {
    gte: { value: 0, error: "Quantity must be 0 or greater" },
  }),
  unit_value: requiredNumberWithConstraints("Unit value is required.", {
    gte: { value: 0, error: "Value must be 0 or greater" },
  }),
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
  cost_basis_per_unit: costBasisSchema,
});

export function UpdatePortfolioRecordForm({
  portfolioRecord,
  onSuccess,
}: UpdatePortfolioRecordFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const initialCostBasis = useMemo(() => {
    if (portfolioRecord.type !== "update") return "";

    const snapshotSource = portfolioRecord.position_snapshots;
    const snapshotArray = Array.isArray(snapshotSource)
      ? snapshotSource
      : snapshotSource
        ? [snapshotSource]
        : [];
    const snapshot = snapshotArray[0];
    return snapshot?.cost_basis_per_unit != null
      ? String(snapshot.cost_basis_per_unit)
      : "";
  }, [portfolioRecord]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(portfolioRecord.date),
      type: portfolioRecord.type,
      quantity: portfolioRecord.quantity,
      unit_value: portfolioRecord.unit_value,
      description: portfolioRecord.description ?? "",
      cost_basis_per_unit: initialCostBasis,
    },
  });

  const recordType = form.watch("type");

  useEffect(() => {
    if (recordType !== "update") {
      form.setValue("cost_basis_per_unit", "");
    } else if (!form.getValues("cost_basis_per_unit")) {
      form.setValue("cost_basis_per_unit", initialCostBasis);
    }
  }, [recordType, form, initialCostBasis]);

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

      if (values.type === "update") {
        const trimmed = values.cost_basis_per_unit?.trim();
        if (trimmed) {
          formData.append("cost_basis_per_unit", trimmed);
        }
      }

      const result = await updatePortfolioRecord(formData, portfolioRecord.id);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Record updated successfully");

      // Close the dialog
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update record",
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
              <FormLabel>Record type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full capitalize">
                    <SelectValue placeholder="Select record type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PORTFOLIO_RECORD_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
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

          <FormField
            control={form.control}
            name="unit_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit value</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupInput
                      placeholder="E.g., 420.69"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      {...field}
                      value={field.value as number}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>
                        {portfolioRecord.positions.currency || "N/A"}
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {recordType === "update" && (
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
                      for P/L. If omitted, we infer it from the unit value.
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
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add a description of this record"
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
                <Spinner />
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
