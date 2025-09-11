"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createRecord } from "@/server/records/create";
import { recalculateRecordsUntilNextUpdate } from "@/server/transactions/recalculate-records";
import { fetchSingleQuote } from "@/server/quotes/fetch";

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
      .select("date, created_at")
      .eq("holding_id", transactionData.holding_id)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!firstRecord) {
      return {
        success: false,
        code: "NO_RECORDS",
        message: "Cannot create transaction before any records exist",
      };
    }

    const transactionDate = new Date(transactionData.date);
    const firstRecordDate = new Date(firstRecord.date);

    // Allow same-day transactions if transaction is after the record was created
    if (
      transactionDate < firstRecordDate ||
      (transactionDate.toDateString() === firstRecordDate.toDateString() &&
        new Date() <= new Date(firstRecord.created_at))
    ) {
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

  // Helper to resolve record unit value (market for symbols; user input for manual holdings)
  const getMarketPriceForRecord = async () => {
    // Check if holding has a symbol
    const { data: holdingMeta } = await supabase
      .from("holdings")
      .select("symbol_id")
      .eq("id", transactionData.holding_id)
      .maybeSingle();

    if (!holdingMeta?.symbol_id) {
      // Manual asset: use user's provided unit_value
      return transactionData.unit_value;
    }

    try {
      const price = await fetchSingleQuote(holdingMeta.symbol_id, {
        date: new Date(transactionData.date),
        upsert: false,
      });
      return price || transactionData.unit_value;
    } catch {
      return transactionData.unit_value;
    }
  };

  // Helper function to cleanup orphaned transaction
  const cleanupTransaction = async () => {
    await supabase.from("transactions").delete().eq("id", transaction.id);
  };

  // Compute record fields
  let recordQuantity: number;
  let recordUnitValue: number;
  let recordCostBasisPerUnit: number;

  if (
    transactionData.type === "sell" ||
    transactionData.type === "withdrawal" ||
    transactionData.type === "buy" ||
    transactionData.type === "deposit"
  ) {
    // For SELL/WITHDRAWAL/BUY/DEPOSIT: Get latest record before transaction date
    const { data: latestRecord } = await supabase
      .from("records")
      .select("quantity, unit_value, cost_basis_per_unit, date, created_at")
      .eq("holding_id", transactionData.holding_id)
      .lte("date", transactionData.date)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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

    // Market price for record
    recordUnitValue = await getMarketPriceForRecord();

    // Cost basis
    const prevCostBasis =
      latestRecord.cost_basis_per_unit ??
      latestRecord.unit_value ??
      transactionData.unit_value;

    if (transactionData.type === "buy" || transactionData.type === "deposit") {
      const newTotalQty = Math.max(
        0,
        latestRecord.quantity + transactionData.quantity,
      );
      recordCostBasisPerUnit =
        newTotalQty > 0
          ? (latestRecord.quantity * prevCostBasis +
              transactionData.quantity * transactionData.unit_value) /
            newTotalQty
          : transactionData.unit_value;
    } else {
      // SELL/WITHDRAWAL: cost basis per unit remains unchanged
      recordCostBasisPerUnit = prevCostBasis;
    }
  } else {
    // For UPDATE: absolute quantity; cost basis comes from user or fallback
    recordQuantity = transactionData.quantity;
    recordUnitValue = await getMarketPriceForRecord();

    const provided = formData.get("cost_basis_per_unit");
    const providedNum =
      provided !== null && String(provided).trim() !== ""
        ? Number(provided)
        : NaN;

    if (!Number.isNaN(providedNum) && providedNum > 0) {
      recordCostBasisPerUnit = providedNum;
    } else {
      const { data: prev } = await supabase
        .from("records")
        .select("cost_basis_per_unit, unit_value")
        .eq("holding_id", transactionData.holding_id)
        .lt("date", transactionData.date)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      recordCostBasisPerUnit =
        prev?.cost_basis_per_unit ?? prev?.unit_value ?? recordUnitValue;
    }
  }

  // Create the record
  const recordFormData = new FormData();
  recordFormData.append("holding_id", transactionData.holding_id);
  recordFormData.append("date", transactionData.date);
  recordFormData.append("quantity", recordQuantity.toString());
  recordFormData.append("unit_value", recordUnitValue.toString());
  recordFormData.append("description", transactionData.description || "");
  recordFormData.append(
    "cost_basis_per_unit",
    recordCostBasisPerUnit.toString(),
  );

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
  const recalculateResult = await recalculateRecordsUntilNextUpdate({
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
