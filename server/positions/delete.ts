"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/actions";

// Single position deletion
export async function deletePosition(positionId: string) {
  const { supabase } = await getCurrentUser();

  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("id", positionId);
  if (error)
    return {
      success: false,
      code: error.code,
      message: error.message,
    } as const;

  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}

// Multiple positions deletion
export async function deletePositions(positionIds: string[]) {
  if (positionIds.length === 0) {
    return {
      success: false,
      code: "no_ids",
      message: "No positions selected.",
    } as const;
  }

  const { supabase } = await getCurrentUser();
  const { error } = await supabase
    .from("positions")
    .delete()
    .in("id", positionIds);
  if (error)
    return {
      success: false,
      code: error.code,
      message: error.message,
    } as const;

  revalidatePath("/dashboard", "layout");
  return { success: true, count: positionIds.length } as const;
}
