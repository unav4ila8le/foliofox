"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";
import { recalculateRecordsAfterDate } from "@/server/transactions/recalculate-records";

// Delete a single transaction (no cascade yet)
export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient();

  // First, get the transaction to know the holding_id and date
  const { data: transaction, error: fetchError } = await supabase
    .from("transactions")
    .select("holding_id, date")
    .eq("id", transactionId)
    .single();

  if (fetchError || !transaction) {
    return {
      success: false,
      code: fetchError?.code || "TRANSACTION_NOT_FOUND",
      message: fetchError?.message || "Transaction not found",
    };
  }

  // Recalculate records from the transaction date forward (excluding this transaction)
  const recalculateResult = await recalculateRecordsAfterDate({
    holdingId: transaction.holding_id,
    fromDate: new Date(transaction.date),
    excludeTransactionId: transactionId,
  });

  if (!recalculateResult.success) {
    return {
      success: false,
      code: "RECALCULATION_FAILED",
      message: "Failed to recalculate records after transaction deletion",
    };
  }

  // Delete the transaction
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId);

  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
