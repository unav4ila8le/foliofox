"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createRecord } from "@/server/records/create";
import { recalculateRecordsAfterDate } from "@/server/transactions/recalculate-records";
import { fetchSingleHolding } from "@/server/holdings/fetch";

import type { Transaction } from "@/types/global.types";

/**
 * Create a new transaction and corresponding record
 */
export async function createTransaction(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Extract transaction data
  const transactionData: Pick<
    Transaction,
    "holding_id" | "type" | "date" | "quantity" | "unit_value" | "description"
  > = {
    holding_id: formData.get("holding_id") as string,
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

  // Check date constraints
  if (transactionData.type !== "update") {
    // BUY/SELL/DEPOSIT/WITHDRAWAL: Must be after first record
    const { data: firstRecord } = await supabase
      .from("records")
      .select("date")
      .eq("holding_id", transactionData.holding_id)
      .order("date", { ascending: true })
      .limit(1)
      .single();

    if (!firstRecord) {
      return {
        success: false,
        code: "NO_RECORDS",
        message: "Cannot create transaction before any records exist",
      };
    }

    if (new Date(transactionData.date) <= new Date(firstRecord.date)) {
      return {
        success: false,
        code: "INVALID_DATE",
        message: "Transaction date must be after the first record date",
      };
    }
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

  // Helper function to get market price for record
  const getMarketPriceForRecord = async () => {
    try {
      const holding = await fetchSingleHolding(transactionData.holding_id, {
        quoteDate: new Date(transactionData.date),
      });
      return holding.current_unit_value;
    } catch {
      // Fall back to transaction price if quote fetch fails
      return transactionData.unit_value;
    }
  };

  // Helper function to cleanup orphaned transaction
  const cleanupTransaction = async () => {
    await supabase.from("transactions").delete().eq("id", transaction.id);
  };

  // Calculate correct record values based on transaction type
  let recordQuantity: number;
  let recordUnitValue: number;

  if (
    transactionData.type === "sell" ||
    transactionData.type === "withdrawal" ||
    transactionData.type === "buy" ||
    transactionData.type === "deposit"
  ) {
    // For SELL/WITHDRAWAL/BUY/DEPOSIT: Get latest record before transaction date
    const { data: latestRecord } = await supabase
      .from("records")
      .select("quantity, unit_value")
      .eq("holding_id", transactionData.holding_id)
      .lt("date", transactionData.date)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (!latestRecord) {
      await cleanupTransaction();
      return {
        success: false,
        code: "NO_BASE_RECORD",
        message: "No base record found to calculate quantity",
      };
    }

    // Calculate quantity based on transaction type
    if (
      transactionData.type === "sell" ||
      transactionData.type === "withdrawal"
    ) {
      recordQuantity = Math.max(
        0,
        latestRecord.quantity - transactionData.quantity,
      );
    } else {
      // buy or deposit
      recordQuantity = latestRecord.quantity + transactionData.quantity;
    }

    recordUnitValue = await getMarketPriceForRecord();
  } else {
    // For UPDATE: Use transaction quantity directly
    recordQuantity = transactionData.quantity;
    recordUnitValue = await getMarketPriceForRecord();
  }

  // Create the record
  const recordFormData = new FormData();
  recordFormData.append("holding_id", transactionData.holding_id);
  recordFormData.append("date", transactionData.date);
  recordFormData.append("quantity", recordQuantity.toString());
  recordFormData.append("unit_value", recordUnitValue.toString());
  recordFormData.append("description", transactionData.description || "");

  const recordResult = await createRecord(recordFormData, transaction.id);

  if (!recordResult.success) {
    await cleanupTransaction();
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
