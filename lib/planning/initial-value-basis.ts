import { z } from "zod";
import { SCENARIO_INITIAL_VALUE_BASES } from "@/types/enums";

export const ScenarioInitialValueBasis = z.enum(SCENARIO_INITIAL_VALUE_BASES);
export type ScenarioInitialValueBasis = z.infer<
  typeof ScenarioInitialValueBasis
>;
