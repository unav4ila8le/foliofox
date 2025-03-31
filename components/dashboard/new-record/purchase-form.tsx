"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/number/format";

const formSchema = z.object({
  date: z.date({
    required_error: "A date of transaction is required.",
  }),
  source_of_funds: z.string({
    required_error: "Please select the source of funds.",
  }),
  asset_type: z.string({
    required_error: "Please select an asset type.",
  }),
  asset_name: z.string().min(1, "Please enter the asset name."),
  quantity: z.string().min(1, "Please enter the quantity."),
  price_per_unit: z.string().min(1, "Please enter the price per unit."),
  currency: z.string({
    required_error: "Please select a currency.",
  }),
  description: z
    .string()
    .max(256, { message: "Description must not exceed 256 characters." })
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export function PurchaseForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      source_of_funds: "",
      asset_type: "",
      asset_name: "",
      quantity: "",
      price_per_unit: "",
      currency: "",
      description: "",
    },
  });

  async function onSubmit(values: FormValues) {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const submitData = {
        ...values,
        quantity: parseFloat(values.quantity.replace(/,/g, "")) || 0,
        price_per_unit:
          parseFloat(values.price_per_unit.replace(/,/g, "")) || 0,
      };

      // TODO: Replace with actual API call
      console.log(submitData);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Show success toast and reset form
      toast.success("Purchase record added successfully");
      form.reset();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add purchase record. Please try again.");
    } finally {
      setIsSubmitting(false);
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
              <FormLabel>Date of transaction</FormLabel>
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
          name="source_of_funds"
          render={({ field }) => (
            <FormItem className="sm:w-1/2 sm:pr-1">
              <FormLabel>Source of funds</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select source of funds" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="bank_account">Bank Account</SelectItem>
                  <SelectItem value="investment_account">
                    Investment Account
                  </SelectItem>
                  <SelectItem value="savings_account">
                    Savings Account
                  </SelectItem>
                  <SelectItem value="cash_wallet">Cash/Wallet</SelectItem>
                  <SelectItem value="credit_line">Credit Line</SelectItem>
                  <SelectItem value="external_transfer">
                    External Transfer
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="asset_type"
          render={({ field }) => (
            <FormItem className="sm:w-1/2 sm:pr-1">
              <FormLabel>Asset type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="crypto">Cryptocurrency</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="precious_metal">Precious Metal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="asset_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asset name/symbol</FormLabel>
              <FormControl>
                <Input placeholder="e.g., AAPL, BTC, VWCE" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-x-2 gap-y-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter quantity"
                    {...field}
                    onBlur={(e) => {
                      const formatted = formatNumber(e.target.value);
                      field.onChange(formatted);
                      field.onBlur();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_per_unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per unit</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter price"
                    {...field}
                    onBlur={(e) => {
                      const formatted = formatNumber(
                        e.target.value,
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        },
                      );
                      field.onChange(formatted);
                      field.onBlur();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem className="sm:w-1/2 sm:pr-1">
              <FormLabel>Currency</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

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

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              className="w-1/2 sm:w-auto"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-1/2 sm:w-auto"
          >
            {isSubmitting && <LoaderCircle className="mr-2 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
