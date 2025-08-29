import { z } from "zod";

export const requiredMinNumber = (
  requiredMessage: string,
  minMessage: string,
) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null)
        return undefined;
      return value;
    },
    z.coerce.number({ error: requiredMessage }).gte(0, { error: minMessage }),
  );

export const requiredGtZeroNumber = (
  requiredMessage: string,
  gtMessage: string,
) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null)
        return undefined;
      return value;
    },
    z.coerce.number({ error: requiredMessage }).gt(0, { error: gtMessage }),
  );

export const requiredNumberWithConstraints = (
  requiredMessage: string,
  options: {
    gt?: { value: number; message: string };
    gte?: { value: number; message: string };
    lt?: { value: number; message: string };
    lte?: { value: number; message: string };
  } = {},
) => {
  // Start with the base coerced number schema
  let numberSchema = z.coerce.number({ message: requiredMessage });

  // Apply constraints to the number schema
  if (options.gt) {
    numberSchema = numberSchema.gt(options.gt.value, {
      message: options.gt.message,
    });
  }
  if (options.gte) {
    numberSchema = numberSchema.gte(options.gte.value, {
      message: options.gte.message,
    });
  }

  if (options.lt) {
    numberSchema = numberSchema.lt(options.lt.value, {
      message: options.lt.message,
    });
  }
  if (options.lte) {
    numberSchema = numberSchema.lte(options.lte.value, {
      message: options.lte.message,
    });
  }

  // Apply preprocessing after all constraints are set
  const schema = z.preprocess((value) => {
    if (value === "" || value === undefined || value === null) return undefined;
    return value;
  }, numberSchema);

  return schema;
};
