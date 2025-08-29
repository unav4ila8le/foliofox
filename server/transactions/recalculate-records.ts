"use server";

import { createServiceClient } from "@/supabase/service";
import { fetchSingleHolding } from "@/server/holdings/fetch";

import type { Transaction } from "@/types/global.types";

interface RecalculateOptions {
  holdingId: string;
  fromDate: Date;
  excludeTransactionId?: string;
  newTransactionData?: Pick<
    Transaction,
    "type" | "quantity" | "unit_value" | "date"
  >;
}

/**
 * Recalculate all records for a holding from a specific date forward
 */
export async function recalculateRecordsAfterDate(options: RecalculateOptions) {
  const { holdingId, fromDate, excludeTransactionId, newTransactionData } =
    options;

  const supabase = await createServiceClient();

  // Find all records that need recalculation
  // Exclude initial holding records (transaction_id = null) from recalculation
  const { data: affectedRecords } = await supabase
    .from("records")
    .select("*")
    .eq("holding_id", holdingId)
    .gt("date", fromDate.toISOString())
    .not("transaction_id", "is", null)
    .order("date", { ascending: true });

  if (!affectedRecords || affectedRecords.length === 0) {
    return { success: true };
  }

  // Get the base record (latest before fromDate)
  const { data: baseRecord } = await supabase
    .from("records")
    .select("*")
    .eq("holding_id", holdingId)
    .lt("date", fromDate.toISOString())
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let runningQuantity = baseRecord?.quantity || 0;

  // Recalculate each record in sequence
  for (const record of affectedRecords) {
    // Get transactions up to this record's date
    let { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("holding_id", holdingId)
      .gt("date", baseRecord?.date || "1900-01-01")
      .lte("date", record.date)
      .order("date", { ascending: true });

    // Filter out excluded transaction if specified
    if (excludeTransactionId) {
      transactions =
        transactions?.filter((t) => t.id !== excludeTransactionId) || [];
    }

    // Helper function to apply transaction to running quantity
    const applyTransaction = (
      transactionData: Pick<Transaction, "type" | "quantity">,
    ) => {
      if (
        transactionData.type === "buy" ||
        transactionData.type === "deposit"
      ) {
        runningQuantity += transactionData.quantity;
      } else if (
        transactionData.type === "sell" ||
        transactionData.type === "withdrawal"
      ) {
        runningQuantity = Math.max(
          0,
          runningQuantity - transactionData.quantity,
        );
      } else if (transactionData.type === "update") {
        // For UPDATE transactions, calculate the relative change from the original baseline
        // and apply it to current running quantity to maintain user's original intent
        const originalBaseline = baseRecord?.quantity || 0;
        const intendedChange = transactionData.quantity - originalBaseline;
        runningQuantity += intendedChange;
      }
    };

    // Apply all transactions up to this record's date
    for (const transaction of transactions || []) {
      applyTransaction(transaction);
    }

    // Apply new transaction data if it affects this record
    if (newTransactionData && newTransactionData.date <= record.date) {
      applyTransaction(newTransactionData);
    }

    // Fetch market price for this record's date
    let marketPrice: number;
    try {
      const holding = await fetchSingleHolding(holdingId, {
        quoteDate: new Date(record.date),
      });
      marketPrice = holding.current_unit_value;
    } catch {
      // Fallback to existing record value or new transaction value
      marketPrice = newTransactionData?.unit_value || record.unit_value || 1;
    }

    // Update this record with new quantity and market price
    await supabase
      .from("records")
      .update({
        quantity: runningQuantity,
        unit_value: marketPrice,
      })
      .eq("id", record.id);
  }

  return { success: true };
}
