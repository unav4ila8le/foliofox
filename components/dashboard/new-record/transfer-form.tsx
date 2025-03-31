"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { ArrowRight, CalendarIcon, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/number/format";
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
import { DialogClose } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z
  .object({
    date: z.date({
      required_error: "A date of transaction is required.",
    }),
    from_account: z.string({
      required_error: "Please select the source account.",
    }),
    to_account: z.string({
      required_error: "Please select the destination account.",
    }),
    amount: z.string().min(1, "Please enter the amount."),
    description: z
      .string()
      .max(256, { message: "Description must not exceed 256 characters." })
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.from_account !== data.to_account, {
    message: "Source and destination accounts must be different",
    path: ["to_account"],
  });

type FormValues = z.infer<typeof formSchema>;

const ACCOUNTS = [
  { id: "checking_usd", name: "Checking Account (USD)", currency: "USD" },
  { id: "savings_usd", name: "Savings Account (USD)", currency: "USD" },
  { id: "checking_eur", name: "Checking Account (EUR)", currency: "EUR" },
  { id: "savings_eur", name: "Savings Account (EUR)", currency: "EUR" },
];

export function TransferForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      from_account: "",
      to_account: "",
      amount: "",
      description: "",
    },
  });

  // Filter accounts based on the selected source account's currency
  const getFilteredAccounts = (sourceCurrency?: string) => {
    if (!sourceCurrency) return ACCOUNTS;
    return ACCOUNTS.filter((account) => account.currency === sourceCurrency);
  };

  // Update available destination accounts when source account changes
  const handleFromAccountChange = (accountId: string) => {
    const account = ACCOUNTS.find((a) => a.id === accountId);
    if (account) {
      setSelectedCurrency(account.currency);
      // Reset destination account if currency doesn't match
      const currentToAccount = form.getValues("to_account");
      const currentToAccountCurrency = ACCOUNTS.find(
        (a) => a.id === currentToAccount,
      )?.currency;
      if (
        currentToAccountCurrency &&
        currentToAccountCurrency !== account.currency
      ) {
        form.setValue("to_account", "");
      }
    }
  };

  async function onSubmit(values: FormValues) {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const submitData = {
        ...values,
        amount: parseFloat(values.amount.replace(/,/g, "")) || 0,
        currency: selectedCurrency,
      };

      // TODO: Replace with actual API call
      console.log("Submit data:", submitData);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Show success toast and reset form
      toast.success("Transfer record added successfully");
      form.reset();
      setSelectedCurrency("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add transfer record. Please try again.");
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

        <div className="grid gap-4 sm:flex sm:items-center sm:gap-1">
          <FormField
            control={form.control}
            name="from_account"
            render={({ field }) => (
              <FormItem className="sm:w-1/2 sm:pr-1">
                <FormLabel>From account</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleFromAccountChange(value);
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select source account" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACCOUNTS.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <ArrowRight className="text-muted-foreground mt-5 hidden h-4 w-4 flex-none sm:block" />

          <FormField
            control={form.control}
            name="to_account"
            render={({ field }) => (
              <FormItem className="sm:w-1/2 sm:pr-1">
                <FormLabel>To account</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select destination account" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {getFilteredAccounts(selectedCurrency).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem className="sm:w-1/2 sm:pr-1">
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter amount"
                  {...field}
                  onBlur={(e) => {
                    const formatted = formatNumber(e.target.value, undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    });
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add any notes about this transfer"
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
