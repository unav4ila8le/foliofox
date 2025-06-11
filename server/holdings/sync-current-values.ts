"use server";

import { getCurrentUser } from "@/server/auth/actions";

// Utility function to sync holding current values with the latest valuation and quantity
export async function syncHoldingCurrentValues(holdingId: string) {
  const { supabase } = await getCurrentUser();

  // Get the most recent valuation and quantity
  const [latestValuation, latestQuantity] = await Promise.all([
    supabase
      .from("holding_valuations")
      .select("unit_value")
      .eq("holding_id", holdingId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("holding_quantities")
      .select("quantity")
      .eq("holding_id", holdingId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Handle errors from queries
  if (latestValuation.error) {
    return {
      success: false,
      code: latestValuation.error.code,
      message: latestValuation.error.message,
    };
  }

  if (latestQuantity.error) {
    return {
      success: false,
      code: latestQuantity.error.code,
      message: latestQuantity.error.message,
    };
  }

  // Update holding with current values (or 0 if no records exist)
  const { error } = await supabase
    .from("holdings")
    .update({
      current_unit_value: latestValuation.data?.unit_value || 0,
      current_quantity: latestQuantity.data?.quantity || 0,
    })
    .eq("id", holdingId);

  if (error) {
    return {
      success: false,
      code: error.code,
      message: error.message,
    };
  }

  return { success: true };
}
