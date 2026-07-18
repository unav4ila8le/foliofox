"use server";

import { readFile } from "fs/promises";
import { join } from "path";

export async function getProductReference() {
  const reference = await readFile(
    join(process.cwd(), "content", "product-reference.md"),
    "utf8",
  );

  return { reference };
}
