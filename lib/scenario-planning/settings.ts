import { z } from "zod";
import type { Json } from "@/types/database.types";

// Product-facing preset IDs used by scenario assumptions.
const SCENARIO_ASSUMPTION_PRESET_IDS = [
  "negative",
  "average",
  "positive",
] as const;

const ScenarioAssumptionPresetIdSchema = z.enum(SCENARIO_ASSUMPTION_PRESET_IDS);

// Assumption inputs are annual nominal percentages.
const ScenarioAssumptionValuesSchema = z.object({
  expectedAnnualReturnPercent: z.number().min(-100).max(100),
  inflationAnnualPercent: z.number().min(-100).max(100),
  volatilityAnnualPercent: z.number().min(0).max(200),
});

const ScenarioAssumptionsSchema = z.object({
  preset: ScenarioAssumptionPresetIdSchema.nullable(),
  values: ScenarioAssumptionValuesSchema,
});

const ScenarioBaselineMetadataSchema = z.object({
  sourceCurrency: z.string().trim().min(1).max(10).optional(),
  sourceMode: z.enum(["net_worth", "cash"]).optional(),
  sourceAsOfDateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sourceSnapshotId: z.uuid().optional(),
});

const ScenarioLooseObjectSchema = z.record(z.string(), z.unknown());

type ScenarioAssumptionPresetId = z.infer<
  typeof ScenarioAssumptionPresetIdSchema
>;
type ScenarioAssumptionValues = z.infer<typeof ScenarioAssumptionValuesSchema>;
type ScenarioAssumptions = z.infer<typeof ScenarioAssumptionsSchema>;
type ScenarioBaselineMetadata = z.infer<typeof ScenarioBaselineMetadataSchema>;
type ScenarioJsonObject = { [key: string]: Json | undefined };

interface ScenarioSettings extends ScenarioJsonObject {
  // Global per-scenario assumptions shared across Scenario/FIRE/Simulations.
  assumptions: ScenarioAssumptions;
  baseline?: ScenarioBaselineMetadata;
  fire?: ScenarioJsonObject;
  simulations?: ScenarioJsonObject;
}

// Placeholder v1 preset constants from roadmap; can be tuned later without schema changes.
const SCENARIO_ASSUMPTION_PRESET_VALUES: Record<
  ScenarioAssumptionPresetId,
  ScenarioAssumptionValues
> = {
  negative: {
    expectedAnnualReturnPercent: 1.5,
    inflationAnnualPercent: 4,
    volatilityAnnualPercent: 22,
  },
  average: {
    expectedAnnualReturnPercent: 7,
    inflationAnnualPercent: 2.5,
    volatilityAnnualPercent: 15,
  },
  positive: {
    expectedAnnualReturnPercent: 10,
    inflationAnnualPercent: 2,
    volatilityAnnualPercent: 12,
  },
};

const getDefaultScenarioAssumptions = (): ScenarioAssumptions => ({
  preset: "average",
  values: { ...SCENARIO_ASSUMPTION_PRESET_VALUES.average },
});

const getDefaultScenarioSettings = (): ScenarioSettings => ({
  assumptions: getDefaultScenarioAssumptions(),
});

// Defensive parse: DB payload might be malformed or legacy; treat non-object as empty object.
const toScenarioSettingsObject = (settings: unknown): ScenarioJsonObject => {
  const parsedSettings = ScenarioLooseObjectSchema.safeParse(settings);
  if (!parsedSettings.success) {
    return {};
  }

  return parsedSettings.data as ScenarioJsonObject;
};

const parseOptionalObject = (
  value: unknown,
): ScenarioJsonObject | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const parsedObject = ScenarioLooseObjectSchema.safeParse(value);
  if (!parsedObject.success) {
    return undefined;
  }

  return parsedObject.data as ScenarioJsonObject;
};

// Read path: always return valid assumptions by falling back to defaults.
const fromDatabaseScenarioSettings = (settings: unknown): ScenarioSettings => {
  const settingsObject = toScenarioSettingsObject(settings);

  const parsedAssumptions = ScenarioAssumptionsSchema.safeParse(
    settingsObject.assumptions,
  );
  const assumptions = parsedAssumptions.success
    ? parsedAssumptions.data
    : getDefaultScenarioAssumptions();

  const parsedBaseline = ScenarioBaselineMetadataSchema.safeParse(
    settingsObject.baseline,
  );
  const baseline = parsedBaseline.success ? parsedBaseline.data : undefined;

  const fire = parseOptionalObject(settingsObject.fire);
  const simulations = parseOptionalObject(settingsObject.simulations);

  return {
    assumptions,
    ...(baseline ? { baseline } : {}),
    ...(fire ? { fire } : {}),
    ...(simulations ? { simulations } : {}),
  };
};

// Write path helper: update only assumptions while preserving unknown future settings keys.
const withScenarioAssumptions = (input: {
  settings: unknown;
  assumptions: ScenarioAssumptions;
}): ScenarioJsonObject => {
  const settingsObject = toScenarioSettingsObject(input.settings);

  return {
    ...settingsObject,
    assumptions: input.assumptions,
  };
};

// Write path helper: update or clear baseline metadata while preserving unknown future settings keys.
const withScenarioBaselineMetadata = (input: {
  settings: unknown;
  baseline?: ScenarioBaselineMetadata;
}): ScenarioJsonObject => {
  const settingsObject = toScenarioSettingsObject(input.settings);

  if (!input.baseline) {
    if (!Object.prototype.hasOwnProperty.call(settingsObject, "baseline")) {
      return settingsObject;
    }

    const nextSettings = { ...settingsObject };
    delete nextSettings.baseline;
    return nextSettings;
  }

  return {
    ...settingsObject,
    baseline: input.baseline,
  };
};

export {
  SCENARIO_ASSUMPTION_PRESET_IDS,
  SCENARIO_ASSUMPTION_PRESET_VALUES,
  ScenarioAssumptionPresetIdSchema,
  ScenarioAssumptionValuesSchema,
  ScenarioAssumptionsSchema,
  ScenarioBaselineMetadataSchema,
  type ScenarioAssumptionPresetId,
  type ScenarioAssumptionValues,
  type ScenarioAssumptions,
  type ScenarioBaselineMetadata,
  type ScenarioSettings,
  getDefaultScenarioAssumptions,
  getDefaultScenarioSettings,
  fromDatabaseScenarioSettings,
  withScenarioAssumptions,
  withScenarioBaselineMetadata,
};
