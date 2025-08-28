"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createRecord } from "@/server/records/create";
import { fetchSingleHolding } from "@/server/holdings/fetch";

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

  // In createTransaction
  const holding = await fetchSingleHolding(transactionData.holding_id);
  const holdingCreatedAt = new Date(holding.created_at);

  if (new Date(transactionData.date) < holdingCreatedAt) {
    return {
      success: false,
      code: "INVALID_DATE",
      message: "Transaction date cannot be before holding creation date",
    };
  }

  // Get the latest record to know current totals
  const { data: latestRecord } = await supabase
    .from("records")
    .select("quantity, unit_value")
    .eq("holding_id", transactionData.holding_id)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Calculate new totals based on transaction type
  let newTotalQuantity: number = 0;
  let newUnitValue: number = 0;

  if (transactionData.type === "update") {
    // Update: Use the new values directly
    newTotalQuantity = transactionData.quantity;
    newUnitValue = transactionData.unit_value;
  } else if (transactionData.type === "buy") {
    // Buy: Add to existing quantity, calculate weighted average price
    const currentQuantity = latestRecord?.quantity || 0;
    const currentValue = (latestRecord?.unit_value || 0) * currentQuantity;
    const newValue = transactionData.quantity * transactionData.unit_value;

    newTotalQuantity = currentQuantity + transactionData.quantity;
    newUnitValue =
      newTotalQuantity > 0 ? (currentValue + newValue) / newTotalQuantity : 0;
  } else if (transactionData.type === "sell") {
    // Sell: Subtract from quantity, keep same unit value (FIFO assumption)
    const currentQuantity = latestRecord?.quantity || 0;
    newTotalQuantity = Math.max(0, currentQuantity - transactionData.quantity);
    newUnitValue = latestRecord?.unit_value || 0;
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

  // Create record with updated totals
  const recordFormData = new FormData();
  recordFormData.append("holding_id", transactionData.holding_id);
  recordFormData.append("date", transactionData.date);
  recordFormData.append("quantity", newTotalQuantity.toString());
  recordFormData.append("unit_value", newUnitValue.toString());
  recordFormData.append("description", transactionData.description || "");

  const recordResult = await createRecord(recordFormData);

  if (!recordResult.success) {
    return {
      success: false,
      code: recordResult.code,
      message: recordResult.message,
    };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
