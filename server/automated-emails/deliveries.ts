"use server";

import { createServiceClient } from "@/supabase/service";
import { isTransientError, retryWithBackoff } from "@/server/shared/retry";
import {
  createAutomatedEmailSender,
  type AutomatedEmailMessage,
  type AutomatedEmailSender,
} from "@/server/automated-emails/sender";

import type { Database } from "@/types/database.types";

type AutomatedEmailType = Database["public"]["Enums"]["automated_email_type"];
type AutomatedEmailDeliveryStatus =
  Database["public"]["Enums"]["automated_email_delivery_status"];

interface DeliveryRecordSummary {
  id: string;
  status: AutomatedEmailDeliveryStatus;
  provider_message_id: string | null;
  updated_at: string;
}

const PENDING_DELIVERY_RECLAIM_MS = 15 * 60 * 1000;

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isProviderRateLimitError(error: unknown) {
  if (!isObjectLike(error)) {
    return false;
  }

  const statusCode =
    typeof error.statusCode === "number"
      ? error.statusCode
      : typeof error.status === "number"
        ? error.status
        : null;

  if (statusCode === 429) {
    return true;
  }

  const errorName = typeof error.name === "string" ? error.name : "";
  if (errorName === "rate_limit_exceeded") {
    return true;
  }

  const errorMessage =
    typeof error.message === "string" ? error.message : String(error);
  return /rate limit|too many requests/i.test(errorMessage);
}

function isRetryableProviderError(error: unknown) {
  return isProviderRateLimitError(error) || isTransientError(error);
}

async function findExistingDeliveryRecord(params: {
  userId: string;
  emailType: AutomatedEmailType;
  deliveryKey: string;
}) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("automated_email_deliveries")
    .select("id, status, provider_message_id, updated_at")
    .eq("user_id", params.userId)
    .eq("email_type", params.emailType)
    .eq("delivery_key", params.deliveryKey)
    .maybeSingle<DeliveryRecordSummary>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Whether a delivery for the given (user, email type, delivery key) tuple has
 * already been marked as sent. Used by the cron orchestrator to short-circuit
 * before building the digest when a previous run already delivered the same
 * window.
 */
export async function isAutomatedEmailDeliveryAlreadySent(params: {
  userId: string;
  emailType: AutomatedEmailType;
  deliveryKey: string;
}) {
  const existingDeliveryRecord = await findExistingDeliveryRecord(params);
  return existingDeliveryRecord?.status === "sent";
}

async function createPendingDeliveryRecord(params: {
  userId: string;
  emailType: AutomatedEmailType;
  deliveryKey: string;
}) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("automated_email_deliveries")
    .insert({
      user_id: params.userId,
      email_type: params.emailType,
      delivery_key: params.deliveryKey,
      status: "pending",
    })
    .select("id, status, provider_message_id, updated_at")
    .single<DeliveryRecordSummary>();

  // Handle concurrent sends racing on the unique delivery key by falling back
  // to the row that another worker created first.
  if (error?.code === "23505") {
    const existingDeliveryRecord = await findExistingDeliveryRecord(params);
    if (existingDeliveryRecord) {
      return {
        created: false as const,
        deliveryRecord: existingDeliveryRecord,
      };
    }
  }

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create pending delivery log");
  }

  return {
    created: true as const,
    deliveryRecord: data,
  };
}

function isPendingDeliveryReclaimable(deliveryRecord: DeliveryRecordSummary) {
  const updatedAtTimestamp = Date.parse(deliveryRecord.updated_at);

  if (Number.isNaN(updatedAtTimestamp)) {
    return false;
  }

  return Date.now() - updatedAtTimestamp >= PENDING_DELIVERY_RECLAIM_MS;
}

async function claimExistingDeliveryRecord(params: {
  deliveryRecord: DeliveryRecordSummary;
}) {
  const supabase = createServiceClient();
  const { deliveryRecord } = params;

  const { data, error } = await supabase
    .from("automated_email_deliveries")
    .update({
      status: "pending",
      provider_message_id: null,
      error_message: null,
      sent_at: null,
    })
    .eq("id", deliveryRecord.id)
    .eq("status", deliveryRecord.status)
    .eq("updated_at", deliveryRecord.updated_at)
    .select("id, status, provider_message_id, updated_at");

  if (error) {
    throw new Error(error.message);
  }

  return data?.[0] ?? null;
}

function buildSkippedDeliveryResult(params: {
  reason: "already_sent" | "in_flight";
  deliveryRecord: DeliveryRecordSummary;
}) {
  return {
    success: true as const,
    skipped: true as const,
    reason: params.reason,
    deliveryRecordId: params.deliveryRecord.id,
    providerMessageId: params.deliveryRecord.provider_message_id,
  };
}

async function markDeliveryRecordStatus(params: {
  deliveryRecordId: string;
  status: AutomatedEmailDeliveryStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}) {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("automated_email_deliveries")
    .update({
      status: params.status,
      provider_message_id: params.providerMessageId ?? null,
      error_message: params.errorMessage ?? null,
      sent_at: params.sentAt ?? null,
    })
    .eq("id", params.deliveryRecordId);

  if (error) {
    throw new Error(error.message);
  }
}

export interface SendAutomatedEmailInput {
  userId: string;
  emailType: AutomatedEmailType;
  deliveryKey: string;
  message: AutomatedEmailMessage;
  sender?: AutomatedEmailSender;
}

export interface SendAutomatedEmailBatchInput {
  items: Array<Omit<SendAutomatedEmailInput, "sender">>;
  sender?: AutomatedEmailSender;
}

export type SendAutomatedEmailResult =
  | {
      success: true;
      skipped: true;
      reason: "already_sent" | "in_flight";
      deliveryRecordId: string;
      providerMessageId: string | null;
    }
  | {
      success: true;
      skipped: false;
      deliveryRecordId: string;
      providerMessageId: string | null;
    }
  | {
      success: false;
      deliveryRecordId: string;
      errorMessage: string;
    };

type DeliveryRecordClaimResult =
  | {
      claimed: true;
      deliveryRecord: DeliveryRecordSummary;
    }
  | {
      claimed: false;
      result: Extract<SendAutomatedEmailResult, { skipped: true }>;
    };

async function claimDeliveryRecordForSend(
  input: Pick<SendAutomatedEmailInput, "userId" | "emailType" | "deliveryKey">,
): Promise<DeliveryRecordClaimResult> {
  // 1. Skip work when the exact delivery window already completed.
  const existingDeliveryRecord = await findExistingDeliveryRecord({
    userId: input.userId,
    emailType: input.emailType,
    deliveryKey: input.deliveryKey,
  });

  if (existingDeliveryRecord?.status === "sent") {
    return {
      claimed: false,
      result: buildSkippedDeliveryResult({
        reason: "already_sent",
        deliveryRecord: existingDeliveryRecord,
      }),
    };
  }

  let deliveryRecord: DeliveryRecordSummary;

  // 2. Claim or create a pending row before attempting provider delivery.
  if (!existingDeliveryRecord) {
    const pendingCreation = await createPendingDeliveryRecord({
      userId: input.userId,
      emailType: input.emailType,
      deliveryKey: input.deliveryKey,
    });

    if (!pendingCreation.created) {
      if (pendingCreation.deliveryRecord.status === "sent") {
        return {
          claimed: false,
          result: buildSkippedDeliveryResult({
            reason: "already_sent",
            deliveryRecord: pendingCreation.deliveryRecord,
          }),
        };
      }

      return {
        claimed: false,
        result: buildSkippedDeliveryResult({
          reason: "in_flight",
          deliveryRecord: pendingCreation.deliveryRecord,
        }),
      };
    }

    deliveryRecord = pendingCreation.deliveryRecord;
  } else if (existingDeliveryRecord.status === "pending") {
    if (!isPendingDeliveryReclaimable(existingDeliveryRecord)) {
      return {
        claimed: false,
        result: buildSkippedDeliveryResult({
          reason: "in_flight",
          deliveryRecord: existingDeliveryRecord,
        }),
      };
    }

    const reclaimedDeliveryRecord = await claimExistingDeliveryRecord({
      deliveryRecord: existingDeliveryRecord,
    });

    if (!reclaimedDeliveryRecord) {
      const latestDeliveryRecord = await findExistingDeliveryRecord({
        userId: input.userId,
        emailType: input.emailType,
        deliveryKey: input.deliveryKey,
      });

      if (latestDeliveryRecord?.status === "sent") {
        return {
          claimed: false,
          result: buildSkippedDeliveryResult({
            reason: "already_sent",
            deliveryRecord: latestDeliveryRecord,
          }),
        };
      }

      return {
        claimed: false,
        result: buildSkippedDeliveryResult({
          reason: "in_flight",
          deliveryRecord: latestDeliveryRecord ?? existingDeliveryRecord,
        }),
      };
    }

    deliveryRecord = reclaimedDeliveryRecord;
  } else {
    const claimedFailedDeliveryRecord = await claimExistingDeliveryRecord({
      deliveryRecord: existingDeliveryRecord,
    });

    if (!claimedFailedDeliveryRecord) {
      const latestDeliveryRecord = await findExistingDeliveryRecord({
        userId: input.userId,
        emailType: input.emailType,
        deliveryKey: input.deliveryKey,
      });

      if (latestDeliveryRecord?.status === "sent") {
        return {
          claimed: false,
          result: buildSkippedDeliveryResult({
            reason: "already_sent",
            deliveryRecord: latestDeliveryRecord,
          }),
        };
      }

      if (latestDeliveryRecord) {
        return {
          claimed: false,
          result: buildSkippedDeliveryResult({
            reason: "in_flight",
            deliveryRecord: latestDeliveryRecord,
          }),
        };
      }

      throw new Error("Failed to claim delivery record for retry");
    }

    deliveryRecord = claimedFailedDeliveryRecord;
  }

  return {
    claimed: true,
    deliveryRecord,
  };
}

/**
 * Persist automated email send state around a provider call.
 */
export async function sendAutomatedEmail(
  input: SendAutomatedEmailInput,
): Promise<SendAutomatedEmailResult> {
  const claimResult = await claimDeliveryRecordForSend(input);

  if (!claimResult.claimed) {
    return claimResult.result;
  }

  const deliveryRecord = claimResult.deliveryRecord;
  const sender = input.sender ?? createAutomatedEmailSender();

  try {
    const sendResult = await retryWithBackoff(
      () => sender.sendEmail(input.message),
      {
        baseDelayMs: 1_000,
        maxDelayMs: 5_000,
        jitterMs: 250,
        shouldRetry: isRetryableProviderError,
      },
    );

    const sentAtTimestamp = new Date().toISOString();

    // 3. Mark the delivery as sent only after the provider responds.
    await markDeliveryRecordStatus({
      deliveryRecordId: deliveryRecord.id,
      status: "sent",
      providerMessageId: sendResult.messageId,
      sentAt: sentAtTimestamp,
    });

    return {
      success: true,
      skipped: false,
      deliveryRecordId: deliveryRecord.id,
      providerMessageId: sendResult.messageId,
    };
  } catch (error) {
    const errorMessage = normalizeErrorMessage(error);

    // 4. Persist the failure so future retries have operator-visible context.
    await markDeliveryRecordStatus({
      deliveryRecordId: deliveryRecord.id,
      status: "failed",
      errorMessage,
    });

    return {
      success: false,
      deliveryRecordId: deliveryRecord.id,
      errorMessage,
    };
  }
}

/**
 * Persist automated email send state around one provider batch call.
 */
export async function sendAutomatedEmailBatch(
  input: SendAutomatedEmailBatchInput,
): Promise<SendAutomatedEmailResult[]> {
  if (input.items.length === 0) {
    return [];
  }

  const sender = input.sender ?? createAutomatedEmailSender();
  if (!sender.sendEmailBatch) {
    const fallbackResults: SendAutomatedEmailResult[] = [];

    for (const item of input.items) {
      fallbackResults.push(await sendAutomatedEmail({ ...item, sender }));
    }

    return fallbackResults;
  }

  const results: Array<SendAutomatedEmailResult | null> = Array.from(
    { length: input.items.length },
    () => null,
  );
  const claimedItems: Array<{
    index: number;
    item: Omit<SendAutomatedEmailInput, "sender">;
    deliveryRecord: DeliveryRecordSummary;
  }> = [];

  for (const [index, item] of input.items.entries()) {
    const claimResult = await claimDeliveryRecordForSend(item);

    if (!claimResult.claimed) {
      results[index] = claimResult.result;
      continue;
    }

    claimedItems.push({
      index,
      item,
      deliveryRecord: claimResult.deliveryRecord,
    });
  }

  if (claimedItems.length === 0) {
    return results.filter(
      (result): result is SendAutomatedEmailResult => result !== null,
    );
  }

  try {
    const sendResult = await retryWithBackoff(
      () =>
        sender.sendEmailBatch!(
          claimedItems.map((claimedItem) => claimedItem.item.message),
        ),
      {
        baseDelayMs: 1_000,
        maxDelayMs: 5_000,
        jitterMs: 250,
        shouldRetry: isRetryableProviderError,
      },
    );
    const sentAtTimestamp = new Date().toISOString();

    await Promise.all(
      claimedItems.map((claimedItem, resultIndex) =>
        markDeliveryRecordStatus({
          deliveryRecordId: claimedItem.deliveryRecord.id,
          status: "sent",
          providerMessageId: sendResult.messageIds[resultIndex] ?? null,
          sentAt: sentAtTimestamp,
        }),
      ),
    );

    claimedItems.forEach((claimedItem, resultIndex) => {
      results[claimedItem.index] = {
        success: true,
        skipped: false,
        deliveryRecordId: claimedItem.deliveryRecord.id,
        providerMessageId: sendResult.messageIds[resultIndex] ?? null,
      };
    });
  } catch (error) {
    const errorMessage = normalizeErrorMessage(error);

    await Promise.all(
      claimedItems.map((claimedItem) =>
        markDeliveryRecordStatus({
          deliveryRecordId: claimedItem.deliveryRecord.id,
          status: "failed",
          errorMessage,
        }),
      ),
    );

    claimedItems.forEach((claimedItem) => {
      results[claimedItem.index] = {
        success: false,
        deliveryRecordId: claimedItem.deliveryRecord.id,
        errorMessage,
      };
    });
  }

  return results.filter(
    (result): result is SendAutomatedEmailResult => result !== null,
  );
}
