"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Record,
  HoldingQuantity,
  HoldingValuation,
} from "@/types/global.types";

type UpdateRecordData = {
  user_id: string;
  type: Record["type"];
  date: string;
  quantity: number;
  value: number;
  description: string | null;
  destination_holding_id: string;
  source_holding_id: string | null;
  currency: string | null;
};

/**
 * Handle update record by creating the record, holding_quantities and holding_valuations entries
 * This ensures all three inserts succeed or all fail together
 *
 * @param recordData - The complete update record data
 * @param supabase - Supabase client instance
 * @returns Promise with success status and optional error message
 */
export async function handleUpdate(
  recordData: UpdateRecordData,
  supabase: SupabaseClient,
) {
  try {
    // 1. Insert the record first
    const { data: recordResult, error: recordError } = await supabase
      .from("records")
      .insert({
        user_id: recordData.user_id,
        type: recordData.type,
        date: recordData.date,
        quantity: recordData.quantity,
        value: recordData.value,
        description: recordData.description,
        destination_holding_id: recordData.destination_holding_id,
        source_holding_id: recordData.source_holding_id,
        currency: recordData.currency,
      })
      .select("id")
      .single();

    // Return Supabase errors instead of throwing
    if (recordError || !recordResult) {
      return {
        success: false,
        code: recordError?.code || "UNEXPECTED_ERROR",
        message: recordError?.message || "Failed to create record",
      };
    }

    const recordId = recordResult.id;

    // 2. Insert holding quantity record
    const quantityData: Omit<
      HoldingQuantity,
      "id" | "description" | "created_at" | "updated_at"
    > = {
      holding_id: recordData.destination_holding_id,
      date: recordData.date,
      quantity: recordData.quantity,
      record_id: recordId,
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

    // 3. Insert holding valuation record
    const valuationData: Omit<
      HoldingValuation,
      "id" | "description" | "created_at" | "updated_at"
    > = {
      holding_id: recordData.destination_holding_id,
      date: recordData.date,
      value: recordData.value,
      record_id: recordId,
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

    return { success: true };
  } catch (error) {
    return {
      success: false,
      code: "UNEXPECTED_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while processing the update",
    };
  }
}
