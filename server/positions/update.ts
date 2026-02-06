"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";

import type { Position } from "@/types/global.types";

export async function updatePosition(formData: FormData, positionId: string) {
  const supabase = await createClient();

  // Extract and validate data from formData
  const updateData: Partial<
    Pick<
      Position,
      "name" | "category_id" | "description" | "capital_gains_tax_rate"
    >
  > = {
    name: formData.get("name") as string,
    category_id: formData.get("category_id") as string,
    description: (formData.get("description") as string) || null,
  };

  if (formData.has("capital_gains_tax_rate")) {
    const capitalGainsTaxRateRaw = formData.get("capital_gains_tax_rate");
    const capitalGainsTaxRate =
      capitalGainsTaxRateRaw != null &&
      String(capitalGainsTaxRateRaw).trim() !== ""
        ? Number(capitalGainsTaxRateRaw)
        : null;
    updateData.capital_gains_tax_rate = capitalGainsTaxRate;
  }

  // Update the position in the database
  const { error } = await supabase
    .from("positions")
    .update(updateData)
    .eq("id", positionId);

  // Return errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
