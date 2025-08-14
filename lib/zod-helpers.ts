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
