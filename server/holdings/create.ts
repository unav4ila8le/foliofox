"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";

import { getSymbolQuote } from "@/server/symbols/search";
import { createRecord } from "@/server/records/create";

import type { Holding } from "@/types/global.types";

// Create holding
export async function createHolding(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Extract and validate data from formData
  const data: Pick<
    Holding,
    "name" | "category_code" | "currency" | "description" | "symbol_id"
  > = {
    name: formData.get("name") as string,
    category_code: formData.get("category_code") as string,
    currency: formData.get("currency") as string,
    description: (formData.get("description") as string) || "",
    symbol_id: (formData.get("symbol_id") as string) || "",
  };

  // Extract current quantity and unit value separately (for the initial record)
  const current_quantity = Number(formData.get("current_quantity"));
  const current_unit_value = Number(formData.get("current_unit_value"));

  // Check if symbol already exists
  if (data.symbol_id) {
    const { data: existingSymbol } = await supabase
      .from("symbols")
      .select("id")
      .eq("id", data.symbol_id)
      .single();

    // If symbol doesn't exist, create it
    if (!existingSymbol) {
      // Get symbol data from Yahoo Finance
      const quoteResult = await getSymbolQuote(data.symbol_id);

      if (quoteResult.success) {
        const { error: symbolError } = await supabase.from("symbols").insert({
          id: data.symbol_id,
          quote_type: quoteResult.data?.quoteType,
          short_name: quoteResult.data?.shortName,
          long_name: quoteResult.data?.longName,
          exchange: quoteResult.data?.exchange,
          currency: quoteResult.data?.currency,
          sector: quoteResult.data?.sector,
          industry: quoteResult.data?.industry,
        });

        // Return errors instead of throwing
        if (symbolError) {
          return {
            success: false,
            code: symbolError.code || "SYMBOL_INSERT_ERROR",
            message: `Failed to create symbol: ${symbolError.message}`,
          };
        }
      } else {
        return {
          success: false,
          code: "QUOTE_FETCH_ERROR",
          message: `Failed to fetch quote data for symbol ${data.symbol_id}: ${quoteResult.message}`,
        };
      }
    }
  }

  // Insert into holdings table
  const { data: holding, error: holdingError } = await supabase
    .from("holdings")
    .insert({
      user_id: user.id,
      ...data,
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

  // Create initial record using the existing createRecord function (convert to formData first)
  const recordFormData = new FormData();
  recordFormData.append("holding_id", holding.id);
  recordFormData.append("date", format(new Date(), "yyyy-MM-dd"));
  recordFormData.append("quantity", current_quantity.toString());
  recordFormData.append("unit_value", current_unit_value.toString());
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
