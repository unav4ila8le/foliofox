import { z } from "zod";
import { SCENARIO_INITIAL_VALUE_BASES } from "@/types/enums";

export const ScenarioInitialValueBasis = z.enum(SCENARIO_INITIAL_VALUE_BASES);
export type ScenarioInitialValueBasis = z.infer<
  typeof ScenarioInitialValueBasis
>;

export const SCENARIO_INITIAL_VALUE_BASIS_LABELS: Record<
  ScenarioInitialValueBasis,
  string
> = {
  net_worth: "Net Worth",
  cash: "Cash",
  manual: "Manual",
};
