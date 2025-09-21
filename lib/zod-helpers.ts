import { z } from "zod";

export const requiredNumberWithConstraints = (
  requiredMessage: string,
  options: {
    gt?: { value: number; error: string };
    gte?: { value: number; error: string };
    lt?: { value: number; error: string };
    lte?: { value: number; error: string };
  } = {},
) => {
  // Start with the base coerced number schema
  let numberSchema = z.coerce.number({ error: requiredMessage });

  // Apply constraints to the number schema
  if (options.gt) {
    numberSchema = numberSchema.gt(options.gt.value, {
      error: options.gt.error,
    });
  }
  if (options.gte) {
    numberSchema = numberSchema.gte(options.gte.value, {
      error: options.gte.error,
    });
  }

  if (options.lt) {
    numberSchema = numberSchema.lt(options.lt.value, {
      error: options.lt.error,
    });
  }
  if (options.lte) {
    numberSchema = numberSchema.lte(options.lte.value, {
      error: options.lte.error,
    });
  }

  // Apply preprocessing after all constraints are set
  const schema = z.preprocess((value) => {
    if (value === "" || value === undefined || value === null) return undefined;
    return value;
  }, numberSchema);

  return schema;
};
