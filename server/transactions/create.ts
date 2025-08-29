"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createRecord } from "@/server/records/create";
import { fetchSingleHolding } from "@/server/holdings/fetch";
import { recalculateRecordsAfterDate } from "@/server/transactions/recalculate-records";

import type { Transaction } from "@/types/global.types";

// Create transaction + updated record
export async function createTransaction(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Extract transaction data
  const transactionData: Pick<
    Transaction,
    "holding_id" | "type" | "date" | "quantity" | "unit_value" | "description"
  > = {
    holding_id: formData.get("holding_id") as string,
    type: formData.get("type") as "buy" | "sell" | "update",
    date: formData.get("date") as string,
    quantity: Number(formData.get("quantity")),
    unit_value: Number(formData.get("unit_value")),
    description: (formData.get("description") as string) || null,
  };

  // Check date constraint (transaction date cannot be before holding creation date)
  const holding = await fetchSingleHolding(transactionData.holding_id);
  const holdingCreatedAt = new Date(holding.created_at);

  if (new Date(transactionData.date) < holdingCreatedAt) {
    return {
      success: false,
      code: "INVALID_DATE",
      message: "Transaction date cannot be before holding creation date",
    };
  }

  // Insert transaction
  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      ...transactionData,
    })
    .select("id")
    .single();

  if (!transaction || transactionError) {
    return {
      success: false,
      code: transactionError?.code || "UNKNOWN",
      message: transactionError?.message || "Failed to create transaction",
    };
  }

  // Create initial record for this transaction
  const recordFormData = new FormData();
  recordFormData.append("holding_id", transactionData.holding_id);
  recordFormData.append("date", transactionData.date);
  recordFormData.append("quantity", transactionData.quantity.toString());
  recordFormData.append("unit_value", transactionData.unit_value.toString());
  recordFormData.append("description", transactionData.description || "");

  const recordResult = await createRecord(recordFormData);

  if (!recordResult.success) {
    return {
      success: false,
      code: recordResult.code,
      message: recordResult.message,
    };
  }

  // Recalculate all records from this transaction date forward
  const recalculateResult = await recalculateRecordsAfterDate({
    holdingId: transactionData.holding_id,
    fromDate: new Date(transactionData.date),
    newTransactionData: {
      type: transactionData.type,
      quantity: transactionData.quantity,
      unit_value: transactionData.unit_value,
      date: transactionData.date,
    },
  });

  if (!recalculateResult.success) {
    return {
      success: false,
      code: "RECALCULATION_FAILED",
      message: "Failed to recalculate records after transaction creation",
    };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
