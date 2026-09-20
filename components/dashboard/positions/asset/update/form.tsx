"use client";

import { toast } from "sonner";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  Field,
  FieldError,
  FieldLabel,
  FieldGroup,
} from "@/components/ui/field";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";
import { PositionCategorySelector } from "@/components/dashboard/categories/position-category-selector";
import { CapitalGainsTaxRateField } from "@/components/dashboard/positions/shared/capital-gains-tax-rate-field";
import { UpdateSymbolDialog } from "@/components/dashboard/positions/shared/update-symbol-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TagPicker } from "@/components/dashboard/position-tags/tag-picker";
import {
  TagDataStatus,
  usePositionTags,
} from "@/components/dashboard/position-tags/provider";

import { updatePosition } from "@/server/positions/update";

import {
  capitalGainsTaxRatePercentSchema,
  formatCapitalGainsTaxRatePercent,
  parseCapitalGainsTaxRatePercent,
} from "@/lib/capital-gains-tax-rate";
import type { Position } from "@/types/global.types";

interface UpdateAssetFormProps {
  position: Position;
  currentSymbolTicker?: string | null;
  onSuccess?: () => void;
  onSavingChange?: (saving: boolean) => void;
}

const formSchema = z.object({
  tag_ids: z.array(z.string()),
  name: z
    .string()
    .min(3, { error: "Name must be at least 3 characters." })
    .max(64, { error: "Name must not exceed 64 characters." }),
  category_id: z.string().min(1, { error: "Category is required." }),
  user_category_id: z.string().nullable(),
  capital_gains_tax_rate: capitalGainsTaxRatePercentSchema,
  description: z
    .string()
    .max(256, {
      error: "Description must not exceed 256 characters.",
    })
    .optional(),
});

export function UpdateAssetForm({
  position,
  currentSymbolTicker,
  onSuccess,
  onSavingChange,
}: UpdateAssetFormProps) {
  const tags = usePositionTags();
  const [initialTagIds] = useState(
    () =>
      tags?.data?.assignments
        .filter((assignment) => assignment.position_id === position.id)
        .map((assignment) => assignment.tag_id) ?? [],
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const [submittedTags, setSubmittedTags] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [updateSymbolDialogOpen, setUpdateSymbolDialogOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tag_ids: initialTagIds,
      name: position.name,
      category_id: position.category_id,
      user_category_id: position.user_category_id,
      capital_gains_tax_rate: formatCapitalGainsTaxRatePercent(
        position.capital_gains_tax_rate,
      ),
      description: position.description ?? "",
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;
  const userCategoryId = useWatch({
    control: form.control,
    name: "user_category_id",
  });
  const draftTagIds = useWatch({ control: form.control, name: "tag_ids" });
  const availableTagIds = new Set(tags?.data?.tags.map((tag) => tag.id));
  const selectedTagIds = draftTagIds.filter((id) => availableTagIds.has(id));

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    onSavingChange?.(true);
    setSaveError(null);
    try {
      // Keep the requested draft while re-reading saved assignments after a lost response.
      let tagData = tags?.data;
      if (requiresRefresh && tags) {
        tagData = await tags.refresh();
        setRequiresRefresh(false);
      }
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("category_id", values.category_id);
      if (values.user_category_id) {
        formData.append("user_category_id", values.user_category_id);
      }
      formData.append("description", values.description || "");
      const capitalGainsTaxRate = parseCapitalGainsTaxRatePercent(
        values.capital_gains_tax_rate,
      );
      formData.append(
        "capital_gains_tax_rate",
        capitalGainsTaxRate != null ? capitalGainsTaxRate.toString() : "",
      );

      const existing = new Set(tagData?.tags.map((tag) => tag.id));
      const requested = values.tag_ids.filter((id) => existing.has(id));
      const baseline = initialTagIds.filter((id) => existing.has(id));
      if (
        submittedTags ||
        requested.length !== baseline.length ||
        requested.some((id) => !baseline.includes(id))
      ) {
        formData.set("tag_ids", JSON.stringify(requested));
        setSubmittedTags(true);
      }

      let result;
      try {
        result = await updatePosition(formData, position.id);
      } catch {
        setRequiresRefresh(true);
        setSaveError(
          "The save outcome is unknown. Your edits are kept. Refresh and retry.",
        );
        await tags?.refresh().catch(() => {});
        return;
      }

      // Handle error response from server action
      if (!result.success) {
        setSaveError(result.message);
        setRequiresRefresh(result.outcomeUnknown);
        if (result.savedSteps.length || result.outcomeUnknown)
          await tags?.refresh().catch(() => {});
        return;
      }

      await tags?.refresh().catch(() => {});

      toast.success("Asset updated successfully");

      // Close the dialog
      onSuccess?.();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to update asset",
      );
    } finally {
      setIsLoading(false);
      onSavingChange?.(false);
    }
  }

  return (
    <>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <DialogBody>
          <FieldGroup>
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            {/* Name */}
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    id={field.name}
                    placeholder="E.g., Chase Savings, Rental Property, Bitcoin Holdings"
                    aria-invalid={fieldState.invalid}
                    disabled={isLoading}
                    {...field}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Category */}
            <Controller
              control={form.control}
              name="category_id"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Category</FieldLabel>
                  <PositionCategorySelector
                    field={field}
                    userCategoryId={userCategoryId}
                    onUserCategoryChange={(value) =>
                      form.setValue("user_category_id", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    disabled={isLoading}
                    isInvalid={fieldState.invalid}
                    allowCustomCategories
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {tags && (
              <Field>
                <FieldLabel>Tags</FieldLabel>
                <TagDataStatus />
                <TagPicker
                  selectedIds={selectedTagIds}
                  onChange={(ids) =>
                    form.setValue("tag_ids", ids, { shouldDirty: true })
                  }
                  label="Choose tags"
                  description="Applied when you save. New tags are created right away."
                  disabled={isLoading}
                />
              </Field>
            )}

            {/* Capital gains tax rate */}
            <CapitalGainsTaxRateField
              control={form.control}
              setValue={form.setValue}
              disabled={isLoading}
              className="sm:w-1/2"
            />

            {/* Description */}
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    Description (optional)
                  </FieldLabel>
                  <Input
                    id={field.name}
                    placeholder="Add a description of this asset"
                    aria-invalid={fieldState.invalid}
                    disabled={isLoading}
                    {...field}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Advanced */}
            <Accordion type="single" collapsible>
              <AccordionItem value="advanced">
                <AccordionTrigger className="text-muted-foreground items-center justify-start text-sm **:data-[slot=accordion-trigger-icon]:ml-1">
                  Advanced
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted/50 space-y-3 rounded-lg border p-4">
                    <div className="space-y-1 text-sm">
                      <h4 className="flex items-center gap-2 font-medium">
                        {currentSymbolTicker
                          ? "Change Ticker Symbol"
                          : "Link Ticker Symbol"}
                      </h4>
                      <p className="text-muted-foreground">
                        {currentSymbolTicker
                          ? "Update the market data symbol linked to this position."
                          : "Link this position to a market data symbol."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setUpdateSymbolDialogOpen(true)}
                    >
                      {currentSymbolTicker ? "Change Symbol" : "Link Symbol"}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </FieldGroup>
        </DialogBody>

        <DialogFooter>
          <Button
            onClick={onSuccess}
            disabled={isLoading}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={
              isLoading ||
              (!isDirty && !saveError) ||
              Boolean(tags?.error) ||
              tags?.isRefreshing
            }
            type="submit"
          >
            {isLoading ? (
              <>
                <Spinner />
                Updating...
              </>
            ) : saveError ? (
              requiresRefresh ? (
                "Refresh and retry"
              ) : (
                "Retry"
              )
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </form>

      <UpdateSymbolDialog
        open={updateSymbolDialogOpen}
        onOpenChangeAction={setUpdateSymbolDialogOpen}
        positionId={position.id}
        currentSymbolTicker={currentSymbolTicker}
      />
    </>
  );
}
