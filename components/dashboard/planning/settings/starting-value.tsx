"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { LocalizedNumberInput } from "@/components/ui/custom/localized-number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import {
  ScenarioInitialValueBasis as ScenarioInitialValueBasisSchema,
  type ScenarioInitialValueBasis,
} from "@/lib/scenario-planning/helpers";
import { formatNumber } from "@/lib/number-format";
import { useLocale } from "@/hooks/use-locale";
import { SCENARIO_INITIAL_VALUE_BASES } from "@/types/enums";
import { updateScenarioInitialValue } from "@/server/financial-scenarios/upsert";

interface PlanningStartingValueSuggestion {
  value: number;
  currency: string;
}

interface PlanningStartingValueSuggestions {
  cash: PlanningStartingValueSuggestion | null;
  netWorth: PlanningStartingValueSuggestion | null;
}

interface PlanningStartingValueProps {
  scenarioId: string;
  initialValue: number;
  initialValueBasis: ScenarioInitialValueBasis;
  currency: string;
  startingValueSuggestions: PlanningStartingValueSuggestions;
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

const getSyncedValueForBasis = (input: {
  basis: ScenarioInitialValueBasis;
  suggestions: PlanningStartingValueSuggestions;
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

const normalizeScenarioValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return value;
  }

  return Number(value.toFixed(2));
};

export function PlanningStartingValue({
  scenarioId,
  initialValue,
  initialValueBasis,
  currency,
  startingValueSuggestions,
}: PlanningStartingValueProps) {
  const locale = useLocale();
  const router = useRouter();
  const lastAutoSyncKey = useRef<string | null>(null);

  const normalizedInitialValue = normalizeScenarioValue(initialValue);

  const [initialValueInput, setInitialValueInput] = useState(
    normalizedInitialValue.toString(),
  );
  const [savedValue, setSavedValue] = useState(normalizedInitialValue);
  const [selectedValueBasis, setSelectedValueBasis] =
    useState<ScenarioInitialValueBasis>(initialValueBasis);
  const [savedValueBasis, setSavedValueBasis] =
    useState<ScenarioInitialValueBasis>(initialValueBasis);
  const [isSavingValue, setIsSavingValue] = useState(false);
  const [isRefreshPending, startRefreshTransition] = useTransition();

  useEffect(() => {
    const normalizedNextValue = normalizeScenarioValue(initialValue);

    setInitialValueInput(normalizedNextValue.toString());
    setSavedValue(normalizedNextValue);
    setSelectedValueBasis(initialValueBasis);
    setSavedValueBasis(initialValueBasis);
    lastAutoSyncKey.current = null;
  }, [initialValue, initialValueBasis]);

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

  const persistInitialValue = useCallback(
    async (input: {
      value: number;
      valueBasis: ScenarioInitialValueBasis;
      showSuccessToast?: boolean;
      refreshAfterSave?: boolean;
    }): Promise<boolean> => {
      const roundedValue = normalizeScenarioValue(input.value);

      setIsSavingValue(true);
      try {
        const result = await updateScenarioInitialValue(
          scenarioId,
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

        if (input.refreshAfterSave) {
          startRefreshTransition(() => {
            router.refresh();
          });
        }

        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update starting value",
        );
        return false;
      } finally {
        setIsSavingValue(false);
      }
    },
    [router, scenarioId],
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
      refreshAfterSave: true,
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

    setInitialValueInput((previousValue) =>
      previousValue === syncedValue.toString()
        ? previousValue
        : syncedValue.toString(),
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
      refreshAfterSave: true,
    }).then((didSave) => {
      if (!didSave && lastAutoSyncKey.current === nextSyncKey) {
        lastAutoSyncKey.current = null;
      }
    });
  }, [
    selectedValueBasis,
    syncedValue,
    savedValueBasis,
    savedValue,
    persistInitialValue,
  ]);

  const handleBasisChange = (nextBasisRaw: string) => {
    lastAutoSyncKey.current = null;

    const parsedBasis = ScenarioInitialValueBasisSchema.safeParse(nextBasisRaw);
    if (!parsedBasis.success) {
      return;
    }

    const nextBasis = parsedBasis.data;

    if (nextBasis !== "manual") {
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

  const isProjectionUpdating = isSavingValue || isRefreshPending;

  return (
    <div className="w-full space-y-2 sm:w-auto">
      <Label htmlFor="initial-value-basis">
        Starting value
        {isProjectionUpdating ? (
          <Spinner className="inline-block size-3.5" />
        ) : null}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedValueBasis}
          onValueChange={handleBasisChange}
          disabled={isProjectionUpdating}
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
        <InputGroup className="flex-1 sm:max-w-56">
          <LocalizedNumberInput
            mode="input-group-input"
            id="initial-value"
            disabled={!isManualMode || isProjectionUpdating}
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
                disabled={!isManualValueDirty || isProjectionUpdating}
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
  );
}
