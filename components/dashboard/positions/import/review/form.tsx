"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Upload, Info, Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { PositionCategorySelector } from "@/components/dashboard/position-category-selector";
import { CurrencySelector } from "@/components/dashboard/currency-selector";
import { SymbolSearch } from "@/components/dashboard/symbol-search";

import type { PositionCategory } from "@/types/global.types";
import type { CurrencyValidationResult } from "@/server/currencies/validate";
import type { SymbolValidationResult } from "@/server/symbols/validate";
import type { PositionImportRow, ImportActionResult } from "@/lib/import/types";

interface ReviewFormProps {
  initialPositions: PositionImportRow[];
  onCancel: () => void;
  onImport: (positions: PositionImportRow[]) => Promise<ImportActionResult>;
  onSuccess: () => void;
  categories: PositionCategory[];
  currencyValidation: Record<string, CurrencyValidationResult>;
  symbolValidation: Record<string, SymbolValidationResult>;
}

export function ReviewForm({
  initialPositions,
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
  const categoryIds = categories.map((cat) => cat.id) as [string, ...string[]];
  const positionSchema = z
    .object({
      name: z
        .string()
        .min(3, { error: "Name must be at least 3 characters" })
        .max(64, { error: "Name must not exceed 64 characters" }),
      category_id: z.enum(categoryIds, {
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
      symbolLookup: z
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
      const hasSymbol = !!val.symbolLookup && val.symbolLookup.trim() !== "";
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
    positions: z.array(positionSchema),
  });

  // Sanitize defaults: replace NaN quantity with null so inputs stay controlled
  const defaultValues = useMemo(() => {
    return {
      positions: initialPositions.map((p) => ({
        ...p,
        quantity: Number.isFinite(p.quantity) ? p.quantity : null,
      })),
    };
  }, [initialPositions]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "positions",
  });

  const { isDirty } = form.formState;

  // Watch for symbol changes and auto-update currency
  useEffect(() => {
    // Watch symbol changes
    const watchedSymbols =
      form.watch("positions")?.map((p) => p.symbolLookup) || [];

    // Auto-update currency
    watchedSymbols.forEach((symbolId, index) => {
      if (
        symbolId &&
        symbolValidation[symbolId]?.valid &&
        symbolValidation[symbolId]?.currency
      ) {
        const symbolCurrency = symbolValidation[symbolId].currency!;
        const currentCurrency = form.getValues(`positions.${index}.currency`);

        if (currentCurrency !== symbolCurrency) {
          form.setValue(`positions.${index}.currency`, symbolCurrency);
        }
      }
    });
  }, [form, symbolValidation]);

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
  }, [form, initialPositions]);

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

      const positions = form.getValues().positions as PositionImportRow[];
      const result = await onImport(positions);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(
        `Successfully imported ${result.importedCount} position(s)!`,
      );
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import positions",
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
                <TableHead>
                  <span className="flex items-center gap-1">
                    Currency
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Currency is automatically set to the currency of the
                        symbol if a symbol is provided.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    Unit Value
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Unit value is required unless symbol is provided. For
                        assets with symbol, the unit value will be fetched from
                        the market.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    Cost Basis
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Cost Basis per Unit is optional. If omitted, we&apos;ll
                        use the unit value as your initial cost basis.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <TableHead>Symbol (Optional)</TableHead>
                <TableHead>Description (Optional)</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
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
                      name={`positions.${index}.name`}
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
                      name={`positions.${index}.category_id`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <PositionCategorySelector
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
                      name={`positions.${index}.currency`}
                      render={({ field }) => {
                        const symbolLookup = form.getValues(
                          `positions.${index}.symbolLookup`,
                        );
                        return (
                          <FormItem>
                            <FormControl>
                              <CurrencySelector
                                field={field}
                                disabled={Boolean(symbolLookup?.trim())}
                                popoverWidth="w-64"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </TableCell>

                  {/* Quantity */}
                  <TableCell className="w-32 align-top">
                    <FormField
                      control={form.control}
                      name={`positions.${index}.quantity`}
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
                      name={`positions.${index}.unit_value`}
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
                      name={`positions.${index}.cost_basis_per_unit`}
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
                          <FormMessage className="whitespace-normal" />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {/* Symbol */}
                  <TableCell className="w-48 align-top">
                    <FormField
                      control={form.control}
                      name={`positions.${index}.symbolLookup`}
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
                      name={`positions.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage className="whitespace-normal" />
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={isImporting}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Delete position</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {/* Add position */}
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={100} className="text-end align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      append({
                        name: "",
                        category_id: "other",
                        currency: "USD",
                        quantity: null,
                        unit_value: null,
                        cost_basis_per_unit: null,
                        symbolLookup: null,
                        description: null,
                      })
                    }
                    disabled={isImporting}
                  >
                    Add position
                    <Plus className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
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
                <Spinner />
                Importing...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Import {fields.length} position(s)
              </>
            )}
          </Button>
        </div>
      </Form>
    </div>
  );
}
