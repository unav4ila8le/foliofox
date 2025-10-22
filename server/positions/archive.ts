"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/actions";

// Single position archiving
export async function archivePosition(positionId: string) {
  const { supabase } = await getCurrentUser();

  const { error } = await supabase
    .from("positions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", positionId);

  if (error)
    return {
      success: false,
      code: error.code,
      message: error.message,
    } as const;

  revalidatePath("/dashboard/assets", "layout");
  return { success: true } as const;
}

// Multiple positions archiving
export async function archivePositions(positionIds: string[]) {
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
    .update({ archived_at: new Date().toISOString() })
    .in("id", positionIds);

  if (error)
    return {
      success: false,
      code: error.code,
      message: error.message,
    } as const;

  revalidatePath("/dashboard/assets", "layout");
  return { success: true, count: positionIds.length } as const;
}
