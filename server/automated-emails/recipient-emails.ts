"use server";

import { chunkArray } from "@/server/shared/chunk-array";
import { createServiceClient } from "@/supabase/service";

const RECIPIENT_LOOKUP_BATCH_SIZE = 25;

/**
 * Resolve email addresses for a set of auth user IDs.
 * Uses Auth Admin lookups only for the explicitly requested user IDs.
 */
export async function fetchRecipientEmailsByUserId(userIds: string[]) {
  const supabase = createServiceClient();
  const resolvedEmailsByUserId = new Map<string, string>();
  const uniqueUserIds = Array.from(
    new Set(userIds.map((userId) => userId.trim()).filter(Boolean)),
  );

  for (const userIdBatch of chunkArray(
    uniqueUserIds,
    RECIPIENT_LOOKUP_BATCH_SIZE,
  )) {
    const batchResults = await Promise.all(
      userIdBatch.map(async (userId) => {
        const { data, error } = await supabase.auth.admin.getUserById(userId);

        if (error) {
          console.warn(
            `Failed to resolve auth email for automated email recipient ${userId}:`,
            error,
          );
          return null;
        }

        const emailAddress = data.user?.email?.trim();
        if (!emailAddress) {
          return null;
        }

        return {
          userId,
          emailAddress,
        };
      }),
    );

    batchResults.forEach((batchResult) => {
      if (!batchResult) {
        return;
      }

      resolvedEmailsByUserId.set(batchResult.userId, batchResult.emailAddress);
    });
  }

  return resolvedEmailsByUserId;
}
