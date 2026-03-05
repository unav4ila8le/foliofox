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
import { useDebounce } from "use-debounce";

import {
  InputGroup,
  InputGroupAddon,
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

import { formatNumber } from "@/lib/number-format";
import { useLocale } from "@/hooks/use-locale";
import {
  SCENARIO_ASSUMPTION_PRESET_VALUES,
  type ScenarioAssumptionPresetId,
  type ScenarioAssumptions,
} from "@/lib/planning/settings";
import { updateScenarioAssumptions } from "@/server/financial-scenarios/upsert";

const MANUAL_PRESET_VALUE = "manual";
const ASSUMPTION_PRESET_DISPLAY_ORDER: ScenarioAssumptionPresetId[] = [
  "positive",
  "average",
  "negative",
];

const PRESET_LABELS: Record<ScenarioAssumptionPresetId, string> = {
  positive: "Positive",
  average: "Average",
  negative: "Negative",
};

const toInputString = (value: number): string => value.toString();

const parsePercentInput = (value: string): number | null => {
  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    return null;
  }

  const parsed = Number(trimmedValue);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

interface PlanningAssumptionsProps {
  scenarioId: string;
  assumptions: ScenarioAssumptions;
}

export function PlanningAssumptions({
  scenarioId,
  assumptions,
}: PlanningAssumptionsProps) {
  const locale = useLocale();
  const router = useRouter();

  const [selectedPreset, setSelectedPreset] =
    useState<ScenarioAssumptionPresetId | null>(assumptions.preset);
  const [expectedReturnInput, setExpectedReturnInput] = useState(
    toInputString(assumptions.values.expectedAnnualReturnPercent),
  );
  const [inflationInput, setInflationInput] = useState(
    toInputString(assumptions.values.inflationAnnualPercent),
  );
  const [volatilityInput, setVolatilityInput] = useState(
    toInputString(assumptions.values.volatilityAnnualPercent),
  );
  const [savedAssumptions, setSavedAssumptions] =
    useState<ScenarioAssumptions>(assumptions);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshPending, startRefreshTransition] = useTransition();
  const hasQueuedManualSaveRef = useRef(false);

  const expectedReturnPlaceholder = useMemo(
    () => `E.g., ${formatNumber(7, { locale })}`,
    [locale],
  );
  const inflationPlaceholder = useMemo(
    () => `E.g., ${formatNumber(2.5, { locale })}`,
    [locale],
  );

  const isManualMode = selectedPreset === null;

  const manualValues = useMemo(() => {
    const expectedAnnualReturnPercent = parsePercentInput(expectedReturnInput);
    const inflationAnnualPercent = parsePercentInput(inflationInput);
    const volatilityAnnualPercent = parsePercentInput(volatilityInput);

    if (
      expectedAnnualReturnPercent === null ||
      inflationAnnualPercent === null ||
      volatilityAnnualPercent === null
    ) {
      return null;
    }

    return {
      expectedAnnualReturnPercent,
      inflationAnnualPercent,
      volatilityAnnualPercent,
    };
  }, [expectedReturnInput, inflationInput, volatilityInput]);

  const isManualDirty =
    isManualMode &&
    (savedAssumptions.preset !== null ||
      manualValues?.expectedAnnualReturnPercent !==
        savedAssumptions.values.expectedAnnualReturnPercent ||
      manualValues?.inflationAnnualPercent !==
        savedAssumptions.values.inflationAnnualPercent ||
      manualValues?.volatilityAnnualPercent !==
        savedAssumptions.values.volatilityAnnualPercent);

  const [debouncedManualValues] = useDebounce(manualValues, 250);

  const persistAssumptions = useCallback(
    async (
      nextAssumptions: ScenarioAssumptions,
      options?: { showSuccessToast?: boolean },
    ) => {
      setIsSaving(true);
      try {
        const result = await updateScenarioAssumptions(
          scenarioId,
          nextAssumptions,
        );
        if (!result.success) {
          throw new Error(result.message || "Failed to update assumptions");
        }

        setSavedAssumptions(nextAssumptions);

        if (options?.showSuccessToast) {
          toast.success("Global assumptions updated");
        }

        startRefreshTransition(() => {
          router.refresh();
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update assumptions",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [router, scenarioId],
  );

  const handlePresetChange = async (nextPresetRaw: string) => {
    if (nextPresetRaw === MANUAL_PRESET_VALUE) {
      setSelectedPreset(null);
      return;
    }

    const nextPreset = ASSUMPTION_PRESET_DISPLAY_ORDER.find(
      (presetId) => presetId === nextPresetRaw,
    );
    if (!nextPreset) {
      return;
    }

    const presetValues = SCENARIO_ASSUMPTION_PRESET_VALUES[nextPreset];

    setSelectedPreset(nextPreset);
    setExpectedReturnInput(
      toInputString(presetValues.expectedAnnualReturnPercent),
    );
    setInflationInput(toInputString(presetValues.inflationAnnualPercent));
    setVolatilityInput(toInputString(presetValues.volatilityAnnualPercent));

    await persistAssumptions(
      {
        preset: nextPreset,
        values: presetValues,
      },
      { showSuccessToast: true },
    );
  };

  const isProjectionUpdating = isSaving || isRefreshPending;

  useEffect(() => {
    // Preserve local selection/inputs while a save + refresh is in-flight.
    // This avoids snapping back to stale server props (often seen as "Manual").
    const shouldPreserveDraft =
      isProjectionUpdating || (selectedPreset === null && isManualDirty);

    if (shouldPreserveDraft) {
      return;
    }

    setSelectedPreset(assumptions.preset);
    setExpectedReturnInput(
      toInputString(assumptions.values.expectedAnnualReturnPercent),
    );
    setInflationInput(toInputString(assumptions.values.inflationAnnualPercent));
    setVolatilityInput(
      toInputString(assumptions.values.volatilityAnnualPercent),
    );
    setSavedAssumptions(assumptions);
  }, [assumptions, isManualDirty, isProjectionUpdating, selectedPreset]);

  useEffect(() => {
    if (!isManualMode) {
      return;
    }

    if (!debouncedManualValues || !isManualDirty) {
      hasQueuedManualSaveRef.current = false;
      return;
    }

    if (isSaving) {
      hasQueuedManualSaveRef.current = true;
      return;
    }

    hasQueuedManualSaveRef.current = false;
    void persistAssumptions({
      preset: null,
      values: debouncedManualValues,
    });
  }, [
    debouncedManualValues,
    isManualDirty,
    isManualMode,
    isSaving,
    persistAssumptions,
  ]);

  useEffect(() => {
    if (isSaving || !hasQueuedManualSaveRef.current) {
      return;
    }

    if (!isManualMode || !debouncedManualValues || !isManualDirty) {
      hasQueuedManualSaveRef.current = false;
      return;
    }

    hasQueuedManualSaveRef.current = false;
    void persistAssumptions({
      preset: null,
      values: debouncedManualValues,
    });
  }, [
    debouncedManualValues,
    isManualDirty,
    isManualMode,
    isSaving,
    persistAssumptions,
  ]);

  return (
    <div className="w-full space-y-2 sm:w-auto">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="assumptions-preset">
            Assumptions
            {isProjectionUpdating ? (
              <Spinner className="inline-block size-3.5" />
            ) : null}
          </Label>
          <Select
            value={selectedPreset ?? MANUAL_PRESET_VALUE}
            onValueChange={handlePresetChange}
            disabled={isProjectionUpdating}
          >
            <SelectTrigger id="assumptions-preset" className="w-40">
              <SelectValue placeholder="Select preset" />
            </SelectTrigger>
            <SelectContent position="popper">
              {ASSUMPTION_PRESET_DISPLAY_ORDER.map((presetId) => (
                <SelectItem key={presetId} value={presetId}>
                  {PRESET_LABELS[presetId]}
                </SelectItem>
              ))}
              <SelectItem value={MANUAL_PRESET_VALUE}>Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expected-annual-return">Growth rate</Label>
          <InputGroup className="flex-1 sm:max-w-28">
            <LocalizedNumberInput
              mode="input-group-input"
              id="expected-annual-return"
              aria-label="Expected annual return percentage"
              disabled={!isManualMode}
              placeholder={expectedReturnPlaceholder}
              name="expected-annual-return"
              value={expectedReturnInput}
              onValueChange={setExpectedReturnInput}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inflation-annual">Inflation rate</Label>
          <InputGroup className="flex-1 sm:max-w-28">
            <LocalizedNumberInput
              mode="input-group-input"
              id="inflation-annual"
              aria-label="Inflation annual percentage"
              disabled={!isManualMode}
              placeholder={inflationPlaceholder}
              name="inflation-annual"
              value={inflationInput}
              onValueChange={setInflationInput}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
      {/* TODO(phase-4): surface volatility input when Simulations UI ships. */}
      <p className="text-muted-foreground text-xs">
        Global settings shared across Scenario, FIRE, and Simulations.
      </p>
    </div>
  );
}
