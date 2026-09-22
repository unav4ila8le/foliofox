import { z } from "zod";

import { AGE_BANDS, RISK_PREFERENCES } from "@/types/enums";

// Form validation schema using Zod
export const financialProfileFormSchema = z.object({
  age_band: z.enum(AGE_BANDS).nullable().optional(),
  income_amount: z
    .preprocess((value) => {
      if (value === "" || value === null || value === undefined) return null;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }, z.number().nonnegative().nullable())
    .optional(),
  income_currency: z.string().trim().length(3).nullable().optional(),
  risk_preference: z.enum(RISK_PREFERENCES).nullable().optional(),
  about: z
    .string()
    .trim()
    .max(2000, { error: "About text must be no more than 2000 characters" })
    .nullable()
    .optional(),
});

/** What the fields hold. `income_amount` is unknown until the schema parses it. */
export type FinancialProfileFormInput = z.input<
  typeof financialProfileFormSchema
>;

/** What `handleSubmit` hands the submit callback. */
export type FinancialProfileFormValues = z.infer<
  typeof financialProfileFormSchema
>;

/**
 * `upsertFinancialProfile` rebuilds every column from FormData, so a missing
 * key writes null. Always send all five.
 */
export function toFinancialProfileFormData(values: FinancialProfileFormValues) {
  const formData = new FormData();
  formData.append("age_band", values.age_band ?? "");
  formData.append("income_amount", values.income_amount?.toString() ?? "");
  formData.append("income_currency", values.income_currency ?? "");
  formData.append("risk_preference", values.risk_preference ?? "");
  formData.append("about", values.about ?? "");
  return formData;
}
