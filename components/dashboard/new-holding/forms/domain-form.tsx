"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useNewHoldingDialog } from "../index";

import { fetchSingleDomainValuation } from "@/server/domain-valuations/fetch";
import { createHolding } from "@/server/holdings/create";

import { requiredNumberWithConstraints } from "@/lib/zod-helpers";

// Helper function to clean domain
function cleanDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "") // Remove http:// or https://
    .replace(/^www\./, "") // Remove www.
    .replace(/\/$/, "") // Remove trailing slash
    .replace(/\/.*$/, ""); // Remove path after domain
}

const formSchema = z.object({
  domain: z.string().regex(z.regexes.domain, { error: "Invalid domain name." }),
  valuation: requiredNumberWithConstraints("Valuation is required.", {
    gt: { value: 0, error: "Valuation must be greater than 0." },
  }),
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function DomainForm() {
  // Props destructuring and context hooks
  const { setOpen } = useNewHoldingDialog();

  // State declarations
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingValuation, setIsCheckingValuation] = useState(false);

  // Form setup and derived state
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      domain: "",
      valuation: "",
      description: "",
    },
  });

  // Watch form values
  const domain = form.watch("domain");
  const valuation = form.watch("valuation") as number;

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Check if domain is valid for API call
  const isDomainValid = domain && z.regexes.domain.test(domain);

  // Check domain valuation
  async function checkDomainValuation() {
    if (!isDomainValid) return;

    setIsCheckingValuation(true);
    try {
      const apiValuation = await fetchSingleDomainValuation(domain, {
        upsert: false,
      });
      if (apiValuation > 0) {
        form.setValue("valuation", apiValuation);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to fetch domain valuation. Please enter a custom valuation.",
      );
    } finally {
      setIsCheckingValuation(false);
    }
  }

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", values.domain);
      formData.append("domain_id", values.domain);
      formData.append("category_code", "domain");
      formData.append("currency", "USD");
      formData.append("quantity", "1");
      formData.append("unit_value", values.valuation.toString());

      // Only append description if it exists
      if (values.description) {
        formData.append("description", values.description);
      }

      const result = await createHolding(formData);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Holding created successfully");
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create a new holding",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        {/* Domain */}
        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    disabled={isCheckingValuation}
                    placeholder="E.g., foliofox.ai"
                    {...field}
                    onChange={(e) => {
                      const cleaned = cleanDomain(e.target.value);
                      field.onChange(cleaned);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={checkDomainValuation}
                    disabled={!isDomainValid || isCheckingValuation}
                    className="absolute top-1/2 right-1 h-7 -translate-y-1/2 rounded-sm text-xs"
                  >
                    {isCheckingValuation ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : (
                      <Search className="size-3" />
                    )}
                    Check valuation
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                Do not include the &quot;https://&quot; or &quot;www.&quot;
                prefix.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Valuation display*/}
        {valuation && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Valuation</p>
            <p className="font-semibold text-green-600">
              {valuation.toLocaleString()} USD
            </p>
            <p className="text-muted-foreground text-sm">
              Valuation is provided by{" "}
              <Link
                href="https://humbleworth.com"
                target="_blank"
                className="hover:text-foreground underline underline-offset-2"
              >
                HumbleWorth
              </Link>
              .
              <br />
              If you prefer, you can add a new custom holding to manually enter
              your own valuation instead.
            </p>
          </div>
        )}

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add a description of this holding"
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
            disabled={isLoading}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={isLoading || !isDirty || !isDomainValid}
            type="submit"
          >
            {isLoading ? (
              <>
                <LoaderCircle className="animate-spin" />
                Saving...
              </>
            ) : (
              "Add holding"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
