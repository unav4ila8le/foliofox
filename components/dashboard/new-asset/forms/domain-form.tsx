"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Search } from "lucide-react";
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
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { HumbleWorthLogo } from "@/components/ui/logos/humbleworth-logo";

import { useNewAssetDialog } from "../index";

import { fetchSingleDomainValuation } from "@/server/domain-valuations/fetch";
import { createPosition } from "@/server/positions/create";

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
  valuation: z.number().gte(0).optional(),
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function DomainForm() {
  // Props destructuring and context hooks
  const { setOpenFormDialog, setOpenSelectionDialog } = useNewAssetDialog();

  // State declarations
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingValuation, setIsCheckingValuation] = useState(false);

  // Form setup and derived state
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      domain: "",
      valuation: undefined,
      description: "",
    },
  });

  // Watch form values
  const domain = form.watch("domain");
  const valuation = form.watch("valuation") as number;

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
          : "Failed to fetch domain valuation. Please try again.",
      );
    } finally {
      setIsCheckingValuation(false);
    }
  }

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      let finalValuation = values.valuation;

      if (!finalValuation || finalValuation <= 0) {
        await checkDomainValuation();
        finalValuation = form.getValues("valuation") as number;
        if (!finalValuation || finalValuation <= 0) {
          throw new Error("Domain valuation could not be determined.");
        }
      }

      const formData = new FormData();
      formData.append("name", values.domain);
      formData.append("domain_id", values.domain);
      formData.append("category_id", "domain");
      formData.append("currency", "USD");
      formData.append("quantity", "1");
      formData.append("unit_value", finalValuation.toString());

      // Only append description if it exists
      if (values.description) {
        formData.append("description", values.description);
      }

      const result = await createPosition(formData);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Asset created successfully");
      form.reset();
      setOpenFormDialog(false);
      setOpenSelectionDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create a new asset",
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
              <FormLabel
                htmlFor={field.name}
                className="flex items-center justify-between gap-2"
              >
                Domain
                <Link
                  href="https://humbleworth.com"
                  target="_blank"
                  aria-label="Go to HumbleWorth website"
                >
                  <HumbleWorthLogo height={14} />
                </Link>
              </FormLabel>
              <FormControl>
                <InputGroup>
                  <InputGroupInput
                    id={field.name}
                    disabled={isCheckingValuation}
                    placeholder="E.g., foliofox.ai"
                    {...field}
                    onChange={(e) => {
                      const cleaned = cleanDomain(e.target.value);
                      field.onChange(cleaned);
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      variant="secondary"
                      onClick={checkDomainValuation}
                      disabled={!isDomainValid || isCheckingValuation}
                    >
                      {isCheckingValuation ? <Spinner /> : <Search />}
                      Check valuation
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
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
              If you prefer, you can add a new custom asset to manually enter
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
                  placeholder="Add a description of this asset"
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
            onClick={() => setOpenFormDialog(false)}
            disabled={isLoading}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button disabled={isLoading || !isDomainValid} type="submit">
            {isLoading ? (
              <>
                <Spinner />
                Saving...
              </>
            ) : (
              "Add Asset"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
