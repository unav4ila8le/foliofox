"use server";

import { createClient } from "@/supabase/client";

interface RecalculateOptions {
  holdingId: string;
  fromDate: Date;
  excludeTransactionId?: string; // The transaction we're updating/deleting
  newTransactionData?: {
    // New data if updating
    type: "buy" | "sell" | "update";
    quantity: number;
    unit_value: number;
    date: string;
  };
}

export async function recalculateRecordsAfterDate(options: RecalculateOptions) {
  const { holdingId, fromDate, excludeTransactionId, newTransactionData } =
    options;
  const supabase = await createClient();

  // Step 1: Find all records that need recalculation
  const { data: affectedRecords } = await supabase
    .from("records")
    .select("*")
    .eq("holding_id", holdingId)
    .gte("date", fromDate.toISOString())
    .order("date", { ascending: true });

  if (!affectedRecords || affectedRecords.length === 0) {
    return { success: true }; // Nothing to recalculate
  }

  // Step 2: Get the "base" record (the one before our changes)
  const { data: baseRecord } = await supabase
    .from("records")
    .select("*")
    .eq("holding_id", holdingId)
    .lt("date", fromDate.toISOString())
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Step 3: Start with the base values
  let runningQuantity = baseRecord?.quantity || 0;
  let runningUnitValue = baseRecord?.unit_value || 0;

  // Step 4: Recalculate each record in sequence
  for (const record of affectedRecords) {
    // Get transactions up to this record's date, EXCLUDING the one we're modifying
    let { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("holding_id", holdingId)
      .gt("date", baseRecord?.date || "1900-01-01")
      .lte("date", record.date)
      .order("date", { ascending: true });

    // Filter out the transaction we're excluding
    if (excludeTransactionId) {
      transactions =
        transactions?.filter((t) => t.id !== excludeTransactionId) || [];
    }

    // Apply transactions to get new running totals
    for (const transaction of transactions || []) {
      if (transaction.type === "buy") {
        const newQuantity = runningQuantity + transaction.quantity;
        const newValue =
          runningQuantity * runningUnitValue +
          transaction.quantity * transaction.unit_value;
        runningQuantity = newQuantity;
        runningUnitValue = newQuantity > 0 ? newValue / newQuantity : 0;
      } else if (transaction.type === "sell") {
        runningQuantity = Math.max(0, runningQuantity - transaction.quantity);
        // runningUnitValue stays the same
      } else if (transaction.type === "update") {
        runningQuantity = transaction.quantity;
        runningUnitValue = transaction.unit_value;
      }
    }

    // If we have new transaction data and it affects this record, apply it
    if (newTransactionData && newTransactionData.date <= record.date) {
      if (newTransactionData.type === "buy") {
        const newQuantity = runningQuantity + newTransactionData.quantity;
        const newValue =
          runningQuantity * runningUnitValue +
          newTransactionData.quantity * newTransactionData.unit_value;
        runningQuantity = newQuantity;
        runningUnitValue = newQuantity > 0 ? newValue / newQuantity : 0;
      } else if (newTransactionData.type === "sell") {
        runningQuantity = Math.max(
          0,
          runningQuantity - newTransactionData.quantity,
        );
      } else if (newTransactionData.type === "update") {
        runningQuantity = newTransactionData.quantity;
        runningUnitValue = newTransactionData.unit_value;
      }
    }

    // Update this record with the new running totals
    await supabase
      .from("records")
      .update({
        quantity: runningQuantity,
        unit_value: runningUnitValue,
      })
      .eq("id", record.id);
  }

  return { success: true };
}
