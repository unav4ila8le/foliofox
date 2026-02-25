"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocalizedNumberInput } from "@/components/ui/custom/localized-number-input";

import { BalanceChart } from "./charts/balance-chart";
import { EventsTable } from "./table/events-table";
import { UpsertEventDialog } from "./dialogs/upsert-event";

import type { Scenario, ScenarioEvent } from "@/lib/scenario-planning";
import {
  ScenarioInitialValueBasis as ScenarioInitialValueBasisSchema,
  type ScenarioInitialValueBasis,
} from "@/lib/scenario-planning/helpers";
import { SCENARIO_INITIAL_VALUE_BASES } from "@/types/enums";

import { formatNumber } from "@/lib/number-format";
import { useLocale } from "@/hooks/use-locale";
import {
  upsertScenarioEvent,
  updateScenarioInitialValue,
} from "@/server/financial-scenarios/upsert";
import { deleteScenarioEvent } from "@/server/financial-scenarios/delete";

interface ScenarioStartingValueSuggestion {
  value: number;
  currency: string;
}

interface ScenarioPlanningClientProps {
  scenario: Scenario & {
    id: string;
    initialValue: number;
    initialValueBasis: ScenarioInitialValueBasis;
  };
  currency: string;
  startingValueSuggestions: {
    cash: ScenarioStartingValueSuggestion | null;
    netWorth: ScenarioStartingValueSuggestion | null;
  };
}

const STARTING_VALUE_BASIS_LABELS: Record<ScenarioInitialValueBasis, string> = {
  net_worth: "Net Worth",
  cash: "Cash",
  manual: "Manual",
};

const STARTING_VALUE_BASIS_OPTIONS = SCENARIO_INITIAL_VALUE_BASES.map(
  (value) => ({
    value,
    label: STARTING_VALUE_BASIS_LABELS[value],
  }),
);

// Resolve the live portfolio-backed value for non-manual modes.
const getSyncedValueForBasis = (input: {
  basis: ScenarioInitialValueBasis;
  suggestions: ScenarioPlanningClientProps["startingValueSuggestions"];
}): number | null => {
  const { basis, suggestions } = input;

  if (basis === "net_worth") {
    return suggestions.netWorth?.value ?? null;
  }

  if (basis === "cash") {
    return suggestions.cash?.value ?? null;
  }

  return null;
};

// Keep persisted scenario values at 2 decimals to avoid long fractional tails.
const normalizeScenarioValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return value;
  }
  return Number(value.toFixed(2));
};

export function ScenarioPlanningClient({
  scenario,
  currency,
  startingValueSuggestions,
}: ScenarioPlanningClientProps) {
  const locale = useLocale();
  const lastAutoSyncKey = useRef<string | null>(null);
  const normalizedInitialValue = normalizeScenarioValue(scenario.initialValue);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{
    event: ScenarioEvent;
    index: number;
  } | null>(null);
  const [initialValueInput, setInitialValueInput] = useState(
    normalizedInitialValue.toString(),
  );
  const [savedValue, setSavedValue] = useState(normalizedInitialValue);
  const [selectedValueBasis, setSelectedValueBasis] =
    useState<ScenarioInitialValueBasis>(scenario.initialValueBasis);
  const [savedValueBasis, setSavedValueBasis] =
    useState<ScenarioInitialValueBasis>(scenario.initialValueBasis);
  const [isSavingValue, setIsSavingValue] = useState(false);

  // Manual mode is editable; synced modes are read-only and auto-persisted.
  const isManualMode = selectedValueBasis === "manual";
  const isManualValueDirty =
    isManualMode &&
    (initialValueInput !== savedValue.toString() ||
      savedValueBasis !== "manual");
  const initialValuePlaceholder = useMemo(
    () => `E.g., ${formatNumber(100000, { locale })}`,
    [locale],
  );
  const syncHint = useMemo(() => {
    if (selectedValueBasis === "cash") {
      return "Synced with your current cash positions.";
    }

    if (selectedValueBasis === "net_worth") {
      return "Synced with your current net worth.";
    }

    return "Set your own value and click Save.";
  }, [selectedValueBasis]);

  const syncedValue = useMemo(() => {
    const nextValue = getSyncedValueForBasis({
      basis: selectedValueBasis,
      suggestions: startingValueSuggestions,
    });

    if (nextValue === null) {
      return null;
    }

    return normalizeScenarioValue(nextValue);
  }, [selectedValueBasis, startingValueSuggestions]);

  const handleEventClick = (event: ScenarioEvent, index: number) => {
    setEditingEvent({ event, index });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setTimeout(() => {
      setEditingEvent(null);
    }, 200);
  };

  const handleSuccess = async (event: ScenarioEvent, index?: number) => {
    try {
      const result = await upsertScenarioEvent(scenario.id, event, index);

      if (!result.success) {
        throw new Error(result.message || "Failed to save event");
      }

      toast.success(
        index !== undefined
          ? "Event updated successfully"
          : "Event created successfully",
      );
      handleDialogClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save event",
      );
    }
  };

  const handleDelete = async (index: number) => {
    try {
      const result = await deleteScenarioEvent(scenario.id, index);

      if (!result.success) {
        throw new Error(result.message || "Failed to delete event");
      }

      toast.success("Event deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete event",
      );
    }
  };

  const persistInitialValue = useCallback(
    async (input: {
      value: number;
      valueBasis: ScenarioInitialValueBasis;
      showSuccessToast?: boolean;
    }) => {
      // This is the single write-path for basis + value persistence.
      const roundedValue = normalizeScenarioValue(input.value);
      setIsSavingValue(true);
      try {
        const result = await updateScenarioInitialValue(
          scenario.id,
          roundedValue,
          {
            initialValueBasis: input.valueBasis,
          },
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to update starting value");
        }

        setSavedValue(roundedValue);
        setSavedValueBasis(input.valueBasis);
        setInitialValueInput(roundedValue.toString());
        if (input.showSuccessToast) {
          toast.success("Starting value saved");
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update starting value",
        );
      } finally {
        setIsSavingValue(false);
      }
    },
    [scenario.id],
  );

  const handleManualSave = async () => {
    const trimmedValue = initialValueInput.trim();

    if (trimmedValue === "") {
      toast.error("Please enter a valid number");
      return;
    }

    const nextValue = Number(trimmedValue);

    if (!Number.isFinite(nextValue)) {
      toast.error("Please enter a valid number");
      return;
    }

    await persistInitialValue({
      value: nextValue,
      valueBasis: "manual",
      showSuccessToast: true,
    });
  };

  useEffect(() => {
    // Non-manual basis values stay synced with current portfolio-derived suggestions.
    if (selectedValueBasis === "manual") {
      return;
    }

    if (syncedValue === null) {
      return;
    }

    const nextSyncKey = `${selectedValueBasis}:${syncedValue}`;

    setInitialValueInput((prevValue) =>
      prevValue === syncedValue.toString() ? prevValue : syncedValue.toString(),
    );

    if (savedValueBasis === selectedValueBasis && savedValue === syncedValue) {
      lastAutoSyncKey.current = nextSyncKey;
      return;
    }

    if (lastAutoSyncKey.current === nextSyncKey) {
      return;
    }

    lastAutoSyncKey.current = nextSyncKey;
    void persistInitialValue({
      value: syncedValue,
      valueBasis: selectedValueBasis,
    });
  }, [
    selectedValueBasis,
    syncedValue,
    savedValueBasis,
    savedValue,
    persistInitialValue,
  ]);

  const handleBasisChange = (nextBasisRaw: string) => {
    // Reset auto-sync dedupe key so switching basis can trigger a fresh write once.
    lastAutoSyncKey.current = null;

    const parsedBasis = ScenarioInitialValueBasisSchema.safeParse(nextBasisRaw);
    if (!parsedBasis.success) {
      return;
    }

    const nextBasis = parsedBasis.data;

    if (nextBasis !== "manual") {
      // Pre-fill immediately for responsive UX; effect below handles persistence.
      const nextSyncedValue = getSyncedValueForBasis({
        basis: nextBasis,
        suggestions: startingValueSuggestions,
      });

      if (nextSyncedValue === null) {
        toast.error("Unable to sync this value right now");
        return;
      }

      setInitialValueInput(normalizeScenarioValue(nextSyncedValue).toString());
    }

    setSelectedValueBasis(nextBasis);
  };

  return (
    <div className="space-y-4">
      {/* Starting value */}
      <div className="space-y-2">
        <Label htmlFor="initial-value-basis">Starting value basis</Label>
        <div className="flex max-w-sm items-center gap-2">
          <Select
            value={selectedValueBasis}
            onValueChange={handleBasisChange}
            disabled={isSavingValue}
          >
            <SelectTrigger id="initial-value-basis" className="w-40">
              <SelectValue placeholder="Select basis" />
            </SelectTrigger>
            <SelectContent position="popper">
              {STARTING_VALUE_BASIS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <InputGroup>
            <LocalizedNumberInput
              mode="input-group-input"
              id="initial-value"
              disabled={!isManualMode || isSavingValue}
              decimalScale={2}
              placeholder={initialValuePlaceholder}
              name="initial-value"
              value={initialValueInput}
              onValueChange={(nextValue) => setInitialValueInput(nextValue)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && isManualMode) {
                  handleManualSave();
                }
              }}
            />
            <InputGroupAddon align="inline-start">
              <InputGroupText>{currency}</InputGroupText>
            </InputGroupAddon>
            {isManualMode && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="secondary"
                  disabled={!isManualValueDirty || isSavingValue}
                  onClick={handleManualSave}
                >
                  Save
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>
        <p className="text-muted-foreground text-xs">{syncHint}</p>
      </div>

      {/* Chart */}
      <BalanceChart
        scenario={scenario}
        currency={currency}
        initialValue={savedValue}
        onAddEvent={() => setDialogOpen(true)}
      />

      {/* Events */}
      {scenario.events.length > 0 && (
        <EventsTable
          events={scenario.events}
          onEventClick={handleEventClick}
          onDelete={handleDelete}
          onAddEvent={() => setDialogOpen(true)}
        />
      )}

      <UpsertEventDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        existingEvents={scenario.events}
        event={editingEvent?.event || null}
        eventIndex={editingEvent?.index ?? null}
        onSuccess={handleSuccess}
        currency={currency}
      />
    </div>
  );
}
