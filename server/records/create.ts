"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { handleUpdate } from "./handle-update";

import type { Record } from "@/types/global.types";

type RecordInsert = Omit<
  Record,
  "id" | "created_at" | "updated_at" | "user_id"
>;

// Create record
export async function createRecord(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Extract record type to determine how to process the data
  const recordType = formData.get("type") as string;

  // Base data extraction
  const baseData = {
    type: recordType as Record["type"],
    date: new Date(formData.get("date") as string).toISOString(),
    description: formData.get("description") as string | null,
  };

  let recordData: RecordInsert;

  // Prepare record data based on type
  switch (recordType) {
    case "purchase": {
      // For purchases: create/update holding and record the transaction
      recordData = {
        ...baseData,
        quantity: Number(formData.get("quantity")),
        value: Number(formData.get("value")), // total value or price_per_unit * quantity
        currency: formData.get("currency") as string,
        destination_holding_id: formData.get("holding_id") as string | null,
        source_holding_id: null,
      };
      break;
    }

    case "sale": {
      // For sales: reduce holding quantity and record the transaction
      recordData = {
        ...baseData,
        quantity: Number(formData.get("quantity")),
        value: Number(formData.get("value")), // total value received
        currency: formData.get("currency") as string,
        source_holding_id: formData.get("holding_id") as string | null,
        destination_holding_id: null,
      };
      break;
    }

    case "transfer": {
      // For transfers: move funds between accounts (no holdings involved)
      recordData = {
        ...baseData,
        quantity: Number(formData.get("amount")),
        value: null, // transfers don't have separate value
        currency: formData.get("currency") as string | null,
        source_holding_id: formData.get("from_holding_id") as string | null,
        destination_holding_id: formData.get("to_holding_id") as string | null,
      };
      break;
    }

    case "update": {
      // For updates: manual adjustment of holding value/quantity
      recordData = {
        ...baseData,
        quantity: Number(formData.get("quantity")),
        value: Number(formData.get("value")),
        currency: null,
        destination_holding_id: formData.get("holding_id") as string | null,
        source_holding_id: null,
      };
      break;
    }

    default:
      return {
        success: false,
        code: "INVALID_TYPE",
        message: "Invalid record type provided",
      };
  }

  // Handle record insertion based on type
  switch (recordType) {
    case "update": {
      // For updates, let the handler manage the entire process
      const updateResult = await handleUpdate(
        {
          user_id: user.id,
          type: recordData.type,
          date: recordData.date,
          quantity: recordData.quantity!,
          value: recordData.value!,
          description: recordData.description,
          destination_holding_id: recordData.destination_holding_id!,
          source_holding_id: recordData.source_holding_id,
          currency: recordData.currency,
        },
        supabase,
      );

      // Return errors from handler
      if (!updateResult.success) {
        return updateResult;
      }

      revalidatePath("/dashboard", "layout");
      return { success: true };
    }

    // For other record types, use centralized insert (for now)
    case "purchase":
    case "sale":
    case "transfer": {
      const { error } = await supabase.from("records").insert({
        user_id: user.id,
        ...recordData,
      });

      if (error) {
        return { success: false, code: error.code, message: error.message };
      }

      revalidatePath("/dashboard", "layout");
      return { success: true };
    }

    default:
      return {
        success: false,
        code: "INVALID_TYPE",
        message: "Invalid record type provided",
      };
  }
}
