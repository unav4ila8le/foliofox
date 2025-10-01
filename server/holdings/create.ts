"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";

import { createSymbol } from "@/server/symbols/create";
import { createRecord } from "@/server/records/create";

import type { Holding } from "@/types/global.types";

// Helper function to check for duplicate holding names
async function checkDuplicateHoldingName(
  holdingName: string,
  userId: string,
  excludeHoldingId?: string,
) {
  const { supabase } = await getCurrentUser();

  let query = supabase
    .from("holdings")
    .select("id")
    .eq("user_id", userId)
    .eq("name", holdingName)
    .is("archived_at", null); // Only check active holdings

  // If updating an existing holding, exclude it from the duplicate check
  if (excludeHoldingId) {
    query = query.neq("id", excludeHoldingId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(`Failed to check for duplicate names: ${error.message}`);
  }

  return data && data.length > 0;
}

// Create holding
export async function createHolding(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Extract and validate data from formData
  const data: Pick<
    Holding,
    "name" | "category_code" | "currency" | "description"
  > = {
    name: formData.get("name") as string,
    category_code: formData.get("category_code") as string,
    currency: formData.get("currency") as string,
    description: (formData.get("description") as string) || null,
  };

  // Extension identifiers
  const symbolId = (formData.get("symbol_id") as string) || null;
  const domainId = (formData.get("domain_id") as string) || null;

  // Check for duplicate holding name
  const isDuplicate = await checkDuplicateHoldingName(data.name, user.id);
  if (isDuplicate) {
    return {
      success: false,
      code: "DUPLICATE_NAME",
      message: `A holding with the name "${data.name}" already exists. Please choose a different name.`,
    };
  }

  // Extract current quantity and unit value separately (for the initial record)
  const quantity = Number(formData.get("quantity"));
  const unit_value = Number(formData.get("unit_value"));

  // Cost basis per unit (fallback to unit value if not provided)
  const cost_basis_per_unit =
    Number(formData.get("cost_basis_per_unit")) || unit_value;

  // Upsert symbol
  if (symbolId) {
    const symbolResult = await createSymbol(symbolId);
    if (!symbolResult.success) {
      return {
        success: false,
        code: symbolResult.code,
        message: symbolResult.message,
      };
    }
  }

  // Determine holding source for consistent typing on creation
  const source = symbolId ? "symbol" : domainId ? "domain" : "custom";

  // Insert into holdings table
  const { data: holding, error: holdingError } = await supabase
    .from("holdings")
    .insert({
      user_id: user.id,
      ...data,
      source,
    })
    .select("id")
    .single();

  // Return Supabase errors instead of throwing
  if (!holding || holdingError) {
    return {
      success: false,
      code: holdingError?.code || "UNKNOWN",
      message: holdingError?.message || "Failed to create holding",
    };
  }

  // Also write to extension tables for market-backed sources
  if (symbolId) {
    const { error: symbolHoldingInsertError } = await supabase
      .from("symbol_holdings")
      .insert({ holding_id: holding.id, symbol_id: symbolId });
    if (symbolHoldingInsertError) {
      return {
        success: false,
        code: symbolHoldingInsertError.code,
        message: symbolHoldingInsertError.message,
      };
    }
  }

  if (domainId) {
    const { error: domainHoldingInsertError } = await supabase
      .from("domain_holdings")
      .insert({ holding_id: holding.id, domain_id: domainId });
    if (domainHoldingInsertError) {
      return {
        success: false,
        code: domainHoldingInsertError.code,
        message: domainHoldingInsertError.message,
      };
    }
  }

  // Create initial record using the existing createRecord function (convert to formData first)
  const recordFormData = new FormData();
  recordFormData.append("holding_id", holding.id);
  recordFormData.append("date", format(new Date(), "yyyy-MM-dd"));
  recordFormData.append("quantity", quantity.toString());
  recordFormData.append("unit_value", unit_value.toString());
  recordFormData.append("cost_basis_per_unit", cost_basis_per_unit.toString());
  recordFormData.append("description", "Initial holding creation");

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
