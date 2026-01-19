"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createSymbol } from "@/server/symbols/create";
import { resolveSymbolInput } from "@/server/symbols/resolve";

import type { Symbol } from "@/types/global.types";

interface UpdatePositionSymbolParams {
  positionId: string;
  symbolLookup: string;
  confirmCurrencyChange?: boolean;
}

export interface UpdatePositionSymbolResult {
  success: boolean;
  code?: string;
  message?: string;
  requiresCurrencyConfirmation?: boolean;
  currentCurrency?: string;
  newCurrency?: string;
  data?: {
    positionId: string;
    symbolId: string;
    currency: string;
  };
}

export async function updatePositionSymbol(
  params: UpdatePositionSymbolParams,
): Promise<UpdatePositionSymbolResult> {
  // 1) Validate input early
  const trimmedLookup = params.symbolLookup?.trim();

  if (!params.positionId || !trimmedLookup) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Position ID and symbol are required.",
    };
  }

  // 2) Get authenticated user + scoped client
  const { supabase, user } = await getCurrentUser();

  // 3) Verify ownership and load current symbol + currency
  const { data: position, error: positionError } = await supabase
    .from("positions")
    .select("id, symbol_id, currency, type")
    .eq("id", params.positionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (positionError) {
    return {
      success: false,
      code: positionError.code ?? "POSITION_FETCH_FAILED",
      message: positionError.message ?? "Failed to fetch position.",
    };
  }

  if (!position) {
    return {
      success: false,
      code: "POSITION_NOT_FOUND",
      message: "Position not found.",
    };
  }

  // 4) Resolve symbol input (create if missing)
  let symbol: Symbol | null = null;
  const resolved = await resolveSymbolInput(trimmedLookup);

  if (resolved?.symbol?.id) {
    symbol = resolved.symbol;
  } else {
    const creationResult = await createSymbol(trimmedLookup);
    if (!creationResult.success || !creationResult.data?.id) {
      return {
        success: false,
        code: creationResult.code ?? "SYMBOL_CREATE_FAILED",
        message:
          creationResult.message ??
          "Unable to create symbol from provided identifier.",
      };
    }
    symbol = creationResult.data;
  }

  // 5) Ensure symbol metadata is complete
  if (!symbol?.id || !symbol.currency) {
    return {
      success: false,
      code: "SYMBOL_RESOLUTION_FAILED",
      message: "Unable to resolve symbol metadata.",
    };
  }

  // 6) Require confirmation when currency changes
  const currencyChanged = position.currency !== symbol.currency;
  if (currencyChanged && !params.confirmCurrencyChange) {
    return {
      success: false,
      code: "CURRENCY_MISMATCH",
      message:
        "Symbol currency differs from the position currency and requires confirmation.",
      requiresCurrencyConfirmation: true,
      currentCurrency: position.currency,
      newCurrency: symbol.currency,
    };
  }

  // 7) Log potential changes for manual review
  const symbolChanged = position.symbol_id !== symbol.id;

  if (symbolChanged || currencyChanged) {
    console.warn("Position symbol update", {
      positionId: position.id,
      userId: user.id,
      previousSymbolId: position.symbol_id,
      nextSymbolId: symbol.id,
      previousCurrency: position.currency,
      nextCurrency: symbol.currency,
    });
  }

  // 8) Update the position with the new symbol + currency
  const { error: updateError } = await supabase
    .from("positions")
    .update({
      symbol_id: symbol.id,
      currency: symbol.currency,
    })
    .eq("id", params.positionId)
    .eq("user_id", user.id);

  if (updateError) {
    return {
      success: false,
      code: updateError.code ?? "POSITION_UPDATE_FAILED",
      message: updateError.message ?? "Failed to update position symbol.",
    };
  }

  // 9) Revalidate dashboard (covers nested dashboard routes)
  revalidatePath("/dashboard");

  return {
    success: true,
    data: {
      positionId: params.positionId,
      symbolId: symbol.id,
      currency: symbol.currency,
    },
  };
}
