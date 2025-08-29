"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";
import { recalculateRecordsAfterDate } from "@/server/transactions/recalculate-records";

import type { Transaction } from "@/types/global.types";

// Update a single transaction
export async function updateTransaction(
  formData: FormData,
  transactionId: string,
) {
  const supabase = await createClient();

  // Extract and validate data from formData
  const updateData: Pick<
    Transaction,
    "type" | "date" | "quantity" | "unit_value" | "description"
  > = {
    type: formData.get("type") as
      | "buy"
      | "sell"
      | "update"
      | "deposit"
      | "withdrawal",
    date: formData.get("date") as string,
    quantity: Number(formData.get("quantity")),
    unit_value: Number(formData.get("unit_value")),
    description: (formData.get("description") as string) || null,
  };

  // First, get the current transaction to know the holding_id and original date
  const { data: currentTransaction, error: fetchError } = await supabase
    .from("transactions")
    .select("holding_id, date")
    .eq("id", transactionId)
    .single();

  if (fetchError || !currentTransaction) {
    return {
      success: false,
      code: fetchError?.code || "TRANSACTION_NOT_FOUND",
      message: fetchError?.message || "Transaction not found",
    };
  }

  // Determine the earliest date that needs recalculation
  const originalDate = new Date(currentTransaction.date);
  const newDate = new Date(updateData.date);
  const fromDate = originalDate < newDate ? originalDate : newDate;

  // Recalculate records from the earliest affected date
  const recalculateResult = await recalculateRecordsAfterDate({
    holdingId: currentTransaction.holding_id,
    fromDate: fromDate,
    excludeTransactionId: transactionId,
    newTransactionData: {
      type: updateData.type,
      quantity: updateData.quantity,
      unit_value: updateData.unit_value,
      date: updateData.date,
    },
  });

  if (!recalculateResult.success) {
    return {
      success: false,
      code: "RECALCULATION_FAILED",
      message: "Failed to recalculate records after transaction update",
    };
  }

  // Update the transaction in the database
  const { error } = await supabase
    .from("transactions")
    .update(updateData)
    .eq("id", transactionId);

  // Return errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
