"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Upload, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { AssetCategorySelector } from "@/components/dashboard/asset-category-selector";
import { CurrencySelector } from "@/components/dashboard/currency-selector";
import { SymbolSearch } from "@/components/dashboard/new-holding/symbol-search";

import type { AssetCategory } from "@/types/global.types";
import type { CurrencyValidationResult } from "@/server/currencies/validate";
import type { SymbolValidationResult } from "@/server/symbols/validate";
import type { HoldingRow, ImportActionResult } from "@/lib/import/types";

interface ReviewFormProps {
  initialHoldings: HoldingRow[];
  onCancel: () => void;
  onImport: (holdings: HoldingRow[]) => Promise<ImportActionResult>;
  onSuccess: () => void;
  categories: AssetCategory[];
  currencyValidation: Record<string, CurrencyValidationResult>;
  symbolValidation: Record<string, SymbolValidationResult>;
}

export function ReviewForm({
  initialHoldings,
  onCancel,
  onImport,
  onSuccess,
  categories,
  currencyValidation,
  symbolValidation,
}: ReviewFormProps) {
  const [hasInitialErrors, setHasInitialErrors] = useState<boolean | null>(
    null,
  );
  const [isImporting, setIsImporting] = useState(false);

  // Create validation schema with dynamic categories
  const categoryCodes = categories.map((cat) => cat.code) as [
    string,
    ...string[],
  ];
  const holdingSchema = z
    .object({
      name: z
        .string()
        .min(3, { error: "Name must be at least 3 characters" })
        .max(64, { error: "Name must not exceed 64 characters" }),
      category_code: z.enum(categoryCodes, {
        error: "Please select a valid category",
      }),
      currency: z
        .string()
        .length(3, { error: "Currency must be 3 letters" })
        .superRefine((val, ctx) => {
          if (!val) return;
          const v = currencyValidation[val];
          if (v && !v.valid) {
            ctx.addIssue({
              code: "custom",
              message: v.error || "Invalid currency",
            });
          }
        }),
      quantity: z.coerce
        .number()
        .gte(0, { error: "Quantity must be 0 or greater" })
        .nullable()
        .refine((val) => val !== null, { message: "Quantity is required" }),
      unit_value: z.coerce
        .number()
        .gte(0, { error: "Unit value must be 0 or greater" })
        .nullable()
        .optional(),
      cost_basis_per_unit: z.coerce
        .number()
        .gte(0, { error: "Cost basis per unit must be 0 or greater" })
        .nullable()
        .optional(),
      symbol_id: z
        .string()
        .nullable()
        .optional()
        .superRefine((val, ctx) => {
          if (!val) return;
          const v = symbolValidation[val];
          if (v && !v.valid) {
            ctx.addIssue({
              code: "custom",
              message: v.error || "Invalid symbol",
            });
          }
        }),
      description: z
        .string()
        .min(3, { error: "Description must be at least 3 characters" })
        .max(256, { error: "Description must not exceed 256 characters" })
        .nullable()
        .optional(),
    })
    .superRefine((val, ctx) => {
      const hasSymbol = !!val.symbol_id && val.symbol_id.trim() !== "";
      if (!hasSymbol) {
        if (val.unit_value === null || !Number.isFinite(val.unit_value)) {
          ctx.addIssue({
            code: "custom",
            path: ["unit_value"],
            message: "Unit value is required when no symbol is provided",
          });
        }
      }
    });

  const formSchema = z.object({
    holdings: z.array(holdingSchema),
  });

  // Sanitize defaults: replace NaN quantity with null so inputs stay controlled
  const defaultValues = useMemo(() => {
    return {
      holdings: initialHoldings.map((h) => ({
        ...h,
        quantity: Number.isFinite(h.quantity) ? h.quantity : null,
      })),
    };
  }, [initialHoldings]);

  const form = useForm({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "holdings",
  });

  const { isDirty } = form.formState;

  // Apply initial errors so they're visible immediately on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const isValid = await form.trigger(undefined, {
        shouldFocus: true,
      });
      if (mounted) {
        setHasInitialErrors(!isValid);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [form, initialHoldings]);

  // Handle import
  const handleImport = async () => {
    setIsImporting(true);

    try {
      // Explicitly trigger validation
      const isValid = await form.trigger(undefined, {
        shouldFocus: true,
      });
      if (!isValid) {
        return;
      }

      const holdings = form.getValues().holdings as HoldingRow[];
      const result = await onImport(holdings);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(
        `Successfully imported ${result.importedCount} holding(s)!`,
      );
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import holdings",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Form {...form}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Value</TableHead>
                <TableHead>Cost Basis (Optional)</TableHead>
                <TableHead>Symbol (Optional)</TableHead>
                <TableHead>Description (Optional)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody
              className={
                isImporting ? "pointer-events-none opacity-50" : undefined
              }
            >
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  {/* Name */}
                  <TableCell className="w-64 align-top">
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {/* Category */}
                  <TableCell className="w-48 align-top">
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.category_code`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <AssetCategorySelector
                              field={field}
                              popoverWidth="w-64"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {/* Currency */}
                  <TableCell className="align-top">
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.currency`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <CurrencySelector
                              field={field}
                              popoverWidth="w-64"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {/* Quantity */}
                  <TableCell className="w-32 align-top">
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="E.g., 10"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              {...field}
                              value={(field.value ?? "") as number | ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v === "" ? null : Number(v));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {/* Unit Value */}
                  <TableCell className="w-32 align-top">
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.unit_value`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="E.g., 42.6"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              {...field}
                              value={(field.value ?? "") as number | ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v === "" ? null : Number(v));
                              }}
                            />
                          </FormControl>
                          <FormMessage className="whitespace-normal" />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {/* Cost Basis */}
                  <TableCell className="align-top">
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.cost_basis_per_unit`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="E.g., 12.41"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              {...field}
                              value={(field.value ?? "") as number | ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v === "" ? null : Number(v));
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {/* Symbol */}
                  <TableCell className="w-48 align-top">
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.symbol_id`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <SymbolSearch
                              field={{
                                ...field,
                                value: field.value || "",
                              }}
                              popoverWidth="w-64"
                            />
                          </FormControl>
                          <FormMessage className="whitespace-normal" />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {/* Description */}
                  <TableCell className="align-top">
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isImporting}>
            Back
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || (hasInitialErrors === true && !isDirty)}
          >
            {isImporting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Import {initialHoldings.length} holding(s)
              </>
            )}
          </Button>
        </div>
      </Form>
    </div>
  );
}
