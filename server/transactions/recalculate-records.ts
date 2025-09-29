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
 * Recalculate records for a holding from a specific date until the next UPDATE transaction.
 * UPDATE transactions act as immutable reset points and stop recalculation.
 * Includes cost basis calculations with weighted averages.
 */
export async function recalculateRecordsUntilNextUpdate(
  options: RecalculateOptions,
) {
  const { holdingId, fromDate, excludeTransactionId, newTransactionData } =
    options;

  const supabase = await createServiceClient();

  // Find the next UPDATE transaction after fromDate to establish boundary
  const { data: nextUpdateTransaction } = await supabase
    .from("transactions")
    .select("date")
    .eq("holding_id", holdingId)
    .eq("type", "update")
    .gt("date", fromDate.toISOString())
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Set recalculation boundary (either next UPDATE or no limit)
  const recalculationBoundary = nextUpdateTransaction?.date;

  // Find all records that need recalculation (between fromDate and boundary)
  // Exclude initial holding records (transaction_id = null) and UPDATE-generated records
  let recordsQuery = supabase
    .from("records")
    .select("*")
    .eq("holding_id", holdingId)
    .gte("date", fromDate.toISOString())
    .not("transaction_id", "is", null);

  // Apply boundary if we found a next UPDATE
  if (recalculationBoundary) {
    recordsQuery = recordsQuery.lt("date", recalculationBoundary);
  }

  const { data: affectedRecords } = await recordsQuery
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (!affectedRecords || affectedRecords.length === 0) {
    return { success: true };
  }

  // Get the base record (latest before fromDate) - this is our reset point
  const { data: baseRecord } = await supabase
    .from("records")
    .select("*")
    .eq("holding_id", holdingId)
    .lte("date", fromDate.toISOString())
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Recalculate each record in sequence
  for (const record of affectedRecords) {
    // Initialize running totals from base record for each calculation
    let runningQuantity = baseRecord?.quantity || 0;
    let runningCostBasis = baseRecord?.cost_basis_per_unit || 0;

    // Get transactions up to this record's date (within our boundary)
    let transactionsQuery = supabase
      .from("transactions")
      .select("*")
      .eq("holding_id", holdingId)
      .gt("date", baseRecord?.date || "1900-01-01")
      .lte("date", record.date)
      .neq("type", "update");

    // Apply boundary to transactions query as well
    if (recalculationBoundary) {
      transactionsQuery = transactionsQuery.lt("date", recalculationBoundary);
    }

    let { data: transactions } = await transactionsQuery
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    // Filter out excluded transaction if specified
    if (excludeTransactionId) {
      transactions =
        transactions?.filter((t) => t.id !== excludeTransactionId) || [];
    }

    // Helper function to apply transaction to running quantities and cost basis
    const applyTransaction = (
      transactionData: Pick<Transaction, "type" | "quantity" | "unit_value">,
    ) => {
      if (
        transactionData.type === "buy" ||
        transactionData.type === "deposit"
      ) {
        // Calculate weighted average cost basis for purchases
        const newShares = transactionData.quantity;
        const newCostBasis = transactionData.unit_value; // For BUY/DEPOSIT, unit_value is what user paid

        if (runningQuantity > 0) {
          // Weighted average: (existing_cost * existing_shares + new_cost * new_shares) / total_shares
          const totalCost =
            runningQuantity * runningCostBasis + newShares * newCostBasis;
          runningQuantity += newShares;
          runningCostBasis = totalCost / runningQuantity;
        } else {
          // First purchase or starting from zero
          runningQuantity = newShares;
          runningCostBasis = newCostBasis;
        }
      } else if (
        transactionData.type === "sell" ||
        transactionData.type === "withdrawal"
      ) {
        // FIFO: Keep same cost basis per unit, reduce quantity
        runningQuantity = Math.max(
          0,
          runningQuantity - transactionData.quantity,
        );
        // Cost basis per unit remains the same when selling
      } else if (transactionData.type === "update") {
        // UPDATE = Reset point - set absolute values
        // Note: This shouldn't happen in our boundary logic, but included for safety
        runningQuantity = transactionData.quantity;
        runningCostBasis = transactionData.unit_value; // Will be overridden by user input in forms
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
        asOfDate: new Date(record.date),
      });
      marketPrice = holding.current_unit_value;
    } catch {
      // Fallback to existing record value or new transaction value
      marketPrice = newTransactionData?.unit_value || record.unit_value || 1;
    }

    // Update this record with new quantity, market price, and cost basis
    await supabase
      .from("records")
      .update({
        quantity: runningQuantity,
        unit_value: marketPrice,
        cost_basis_per_unit: runningCostBasis,
      })
      .eq("id", record.id);
  }

  return { success: true };
}
