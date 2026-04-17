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
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function findExistingDeliveryRecord(params: {
  userId: string;
  emailType: AutomatedEmailType;
  deliveryKey: string;
}) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("automated_email_deliveries")
    .select("id, status, provider_message_id")
    .eq("user_id", params.userId)
    .eq("email_type", params.emailType)
    .eq("delivery_key", params.deliveryKey)
    .maybeSingle<DeliveryRecordSummary>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
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
    .select("id, status, provider_message_id")
    .single<DeliveryRecordSummary>();

  // Handle concurrent sends racing on the unique delivery key by falling back
  // to the row that another worker created first.
  if (error?.code === "23505") {
    const existingDeliveryRecord = await findExistingDeliveryRecord(params);
    if (existingDeliveryRecord) {
      return existingDeliveryRecord;
    }
  }

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create pending delivery log");
  }

  return data;
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

export type SendAutomatedEmailResult =
  | {
      success: true;
      skipped: true;
      reason: "already_sent";
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

/**
 * Persist automated email send state around a provider call.
 */
export async function sendAutomatedEmail(
  input: SendAutomatedEmailInput,
): Promise<SendAutomatedEmailResult> {
  // 1. Skip work when the exact delivery window already completed.
  const existingDeliveryRecord = await findExistingDeliveryRecord({
    userId: input.userId,
    emailType: input.emailType,
    deliveryKey: input.deliveryKey,
  });

  if (existingDeliveryRecord?.status === "sent") {
    return {
      success: true,
      skipped: true,
      reason: "already_sent",
      deliveryRecordId: existingDeliveryRecord.id,
      providerMessageId: existingDeliveryRecord.provider_message_id,
    };
  }

  // 2. Create the pending log row before attempting provider delivery.
  const deliveryRecord =
    existingDeliveryRecord ??
    (await createPendingDeliveryRecord({
      userId: input.userId,
      emailType: input.emailType,
      deliveryKey: input.deliveryKey,
    }));

  const sender = input.sender ?? createAutomatedEmailSender();

  try {
    const sendResult = await retryWithBackoff(
      () => sender.sendEmail(input.message),
      {
        shouldRetry: isTransientError,
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
