"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";

import type { HoldingQuantity, HoldingValuation } from "@/types/global.types";

// Update holding value and quantity
export async function updateHolding(formData: FormData) {
  const supabase = await createClient();

  // Extract and validate data from formData
  const data = {
    holding_id: formData.get("item") as string,
    date: new Date(formData.get("date") as string),
    amount: Number(formData.get("amount")),
    value: Number(formData.get("value")),
    description: formData.get("description") as string | null,
  };

  // Create properly typed quantity record
  const quantityData: Omit<HoldingQuantity, "id" | "created_at"> = {
    holding_id: data.holding_id,
    date: data.date.toISOString(),
    quantity: data.amount,
    description: data.description,
  };

  // Insert new quantity record
  const { error: quantityError } = await supabase
    .from("holding_quantities")
    .insert(quantityData);

  if (quantityError) {
    return {
      success: false,
      code: quantityError.code,
      message: quantityError.message,
    };
  }

  // Create properly typed valuation record
  const valuationData: Omit<HoldingValuation, "id" | "created_at"> = {
    holding_id: data.holding_id,
    date: data.date.toISOString(),
    value: data.value,
    description: data.description,
  };

  // Insert new valuation record
  const { error: valuationError } = await supabase
    .from("holding_valuations")
    .insert(valuationData);

  if (valuationError) {
    return {
      success: false,
      code: valuationError.code,
      message: valuationError.message,
    };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
