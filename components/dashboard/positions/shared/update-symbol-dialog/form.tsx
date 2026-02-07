"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, Info } from "lucide-react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SymbolSearch } from "@/components/dashboard/symbol-search";

import { updatePositionSymbol } from "@/server/positions/update-symbol";

interface UpdateSymbolFormProps {
  positionId: string;
  currentSymbolTicker?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const formSchema = z.object({
  symbolLookup: z
    .string()
    .min(1, { message: "Please select a symbol." })
    .max(32, { message: "Symbol must not exceed 32 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

export function UpdateSymbolForm({
  positionId,
  currentSymbolTicker,
  onSuccess,
  onCancel,
}: UpdateSymbolFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currencyConfirmation, setCurrencyConfirmation] = useState<{
    currentCurrency: string;
    newCurrency: string;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      symbolLookup: "",
    },
  });

  const { isDirty } = form.formState;
  const selectedSymbol = form.watch("symbolLookup");

  async function onSubmit(
    values: FormValues,
    confirmCurrencyChange: boolean = false,
  ) {
    setIsLoading(true);

    try {
      const result = await updatePositionSymbol({
        positionId,
        symbolLookup: values.symbolLookup,
        confirmCurrencyChange,
      });

      // Handle currency mismatch - prompt for confirmation
      if (
        result.code === "CURRENCY_MISMATCH" &&
        result.requiresCurrencyConfirmation
      ) {
        setCurrencyConfirmation({
          currentCurrency: result.currentCurrency!,
          newCurrency: result.newCurrency!,
        });
        setIsLoading(false);
        return;
      }

      if (!result.success) {
        throw new Error(result.message || "Failed to update ticker symbol");
      }

      toast.success(result.message || "Ticker symbol updated successfully");
      router.refresh();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update ticker symbol",
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Handle confirmed currency change
  const handleConfirmCurrencyChange = () => {
    const values = form.getValues();
    onSubmit(values, true);
    setCurrencyConfirmation(null);
  };

  const handleCancelCurrencyChange = () => {
    setCurrencyConfirmation(null);
    form.reset();
  };

  // Show currency confirmation UI
  if (currencyConfirmation) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Currency Mismatch</AlertTitle>
          <AlertDescription>
            <div>
              <span className="font-medium">{selectedSymbol}</span> uses{" "}
              <span className="font-medium">
                {currencyConfirmation.newCurrency}
              </span>
              , but this position is currently in{" "}
              <span className="font-medium">
                {currencyConfirmation.currentCurrency}
              </span>
              . Changing the symbol will also update the position&apos;s
              currency to{" "}
              <span className="font-medium">
                {currencyConfirmation.newCurrency}
              </span>
              .
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCancelCurrencyChange}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmCurrencyChange}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner /> Updating...
              </>
            ) : (
              "Confirm Change"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="space-y-4"
    >
      {/* Warning about what changes */}
      <Alert>
        <Info className="size-4" />
        <AlertTitle>What will change</AlertTitle>
        <AlertDescription>
          Changing the symbol updates market data, dividends, news, and
          historical analytics. Transactions remain unchanged.
        </AlertDescription>
      </Alert>

      {/* Current symbol info */}
      {currentSymbolTicker && (
        <div className="text-muted-foreground text-sm">
          Current symbol:{" "}
          <span className="text-foreground font-medium">
            {currentSymbolTicker}
          </span>
        </div>
      )}

      {/* Symbol search field */}
      <Controller
        control={form.control}
        name="symbolLookup"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>New Symbol</FieldLabel>
            <SymbolSearch
              field={field}
              isInvalid={fieldState.invalid}
              fieldName={field.name}
              clearErrors={form.clearErrors as (name: string) => void}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !isDirty || !selectedSymbol}
        >
          {isLoading ? (
            <>
              <Spinner /> Updating...
            </>
          ) : (
            "Update Symbol"
          )}
        </Button>
      </div>
    </form>
  );
}
