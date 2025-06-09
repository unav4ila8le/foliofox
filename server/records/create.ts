"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type {
  Record,
  HoldingQuantity,
  HoldingValuation,
} from "@/types/global.types";

// Create record
export async function createRecord(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Extract and validate data from formData
  const data: Pick<
    Record,
    "date" | "holding_id" | "quantity" | "value" | "description"
  > = {
    date: formData.get("date") as string,
    holding_id: formData.get("holding_id") as string,
    quantity: Number(formData.get("quantity")),
    value: Number(formData.get("value")),
    description: (formData.get("description") as string) || null,
  };

  // Insert into records table
  const { data: record, error: recordError } = await supabase
    .from("records")
    .insert({
      user_id: user.id,
      ...data,
    })
    .select("id")
    .single();

  // Return Supabase errors instead of throwing
  if (!record || recordError) {
    return {
      success: false,
      code: recordError?.code || "UNKNOWN",
      message: recordError?.message || "Failed to create record",
    };
  }

  // Create holding_quantities entry
  const quantityData: Pick<
    HoldingQuantity,
    "holding_id" | "date" | "quantity" | "description" | "record_id"
  > = {
    holding_id: data.holding_id,
    date: data.date,
    quantity: data.quantity,
    description: "New record",
    record_id: record.id,
  };

  const { error: quantityError } = await supabase
    .from("holding_quantities")
    .insert(quantityData);

  // Return Supabase errors instead of throwing
  if (quantityError) {
    return {
      success: false,
      code: quantityError.code,
      message: quantityError.message,
    };
  }

  // Create holding_valuations entry
  const valuationData: Pick<
    HoldingValuation,
    "holding_id" | "date" | "value" | "description" | "record_id"
  > = {
    holding_id: data.holding_id,
    date: data.date,
    value: data.value,
    description: "New record",
    record_id: record.id,
  };

  const { error: valuationError } = await supabase
    .from("holding_valuations")
    .insert(valuationData);

  // Return Supabase errors instead of throwing
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
