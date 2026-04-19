"use server";

import { chunkArray } from "@/server/shared/chunk-array";
import { createServiceClient } from "@/supabase/service";
import { buildAutomatedEmailDigest } from "@/server/automated-emails/digest";
import { sendAutomatedEmail } from "@/server/automated-emails/deliveries";
import { fetchRecipientEmailsByUserId } from "@/server/automated-emails/recipient-emails";
import { createAutomatedEmailSender } from "@/server/automated-emails/sender";
import { evaluateAutomatedEmailSchedule } from "@/server/automated-emails/schedule";
import {
  AUTOMATED_EMAIL_BATCH_SIZE,
  AUTOMATED_EMAIL_SEND_HOUR_LOCAL,
  REENGAGEMENT_COOLDOWN_DAYS,
  REENGAGEMENT_INACTIVITY_DAYS,
} from "@/server/automated-emails/constants";
import {
  buildReengagementEmailTemplate,
  buildWeeklyRecapEmailTemplate,
} from "@/server/automated-emails/templates";

import type { Profile } from "@/types/global.types";

interface EmailPreferenceCandidateRow {
  user_id: string;
  weekly_recap_enabled: boolean;
  marketing_emails_enabled: boolean;
  profiles:
    | Pick<
        Profile,
        | "user_id"
        | "username"
        | "display_currency"
        | "time_zone"
        | "last_app_activity_at"
      >
    | Array<
        Pick<
          Profile,
          | "user_id"
          | "username"
          | "display_currency"
          | "time_zone"
          | "last_app_activity_at"
        >
      >
    | null;
}

interface AutomatedEmailCandidate {
  userId: string;
  username: string;
  displayCurrency: string;
  timeZone: string;
  lastAppActivityAt: string | null;
  weeklyRecapEnabled: boolean;
  marketingEmailsEnabled: boolean;
}

interface DueAutomatedEmailJob {
  userId: string;
  username: string;
  displayCurrency: string;
  timeZone: string;
  emailType: "weekly_recap" | "reengagement";
  deliveryKey: string;
}

export interface AutomatedEmailCronStats {
  enabled: boolean;
  now: string;
  sendHourLocal: number;
  inactivityDays: number;
  cooldownDays: number;
  batchSize: number;
  scannedUsers: number;
  dueUsers: number;
  weeklyDue: number;
  reengagementDue: number;
  skippedNoEmail: number;
  skippedNoActivePositions: number;
  skippedAlreadySent: number;
  sent: number;
  failed: number;
  batchCount: number;
  missingEnvVars: string[];
}

interface RunAutomatedEmailCronResult {
  success: boolean;
  message: string;
  stats: AutomatedEmailCronStats;
}

function resolveConfiguredFromAddress() {
  return process.env.EMAILS_FROM_ADDRESS?.trim() ?? null;
}

function resolveMissingAutomatedEmailEnvVars() {
  const requiredEnvVars = [
    "AUTOMATED_EMAILS_ENABLED",
    "RESEND_API_KEY",
    "EMAILS_FROM_ADDRESS",
    "EMAIL_LINK_SECRET",
    "NEXT_PUBLIC_SITE_URL",
  ] as const;

  return requiredEnvVars.filter((envVarName) => {
    const envValue = process.env[envVarName];
    return !envValue || envValue.trim().length === 0;
  });
}

function createBaseStats(
  now: Date,
  missingEnvVars: string[],
): AutomatedEmailCronStats {
  return {
    enabled: process.env.AUTOMATED_EMAILS_ENABLED === "true",
    now: now.toISOString(),
    sendHourLocal: AUTOMATED_EMAIL_SEND_HOUR_LOCAL,
    inactivityDays: REENGAGEMENT_INACTIVITY_DAYS,
    cooldownDays: REENGAGEMENT_COOLDOWN_DAYS,
    batchSize: AUTOMATED_EMAIL_BATCH_SIZE,
    scannedUsers: 0,
    dueUsers: 0,
    weeklyDue: 0,
    reengagementDue: 0,
    skippedNoEmail: 0,
    skippedNoActivePositions: 0,
    skippedAlreadySent: 0,
    sent: 0,
    failed: 0,
    batchCount: 0,
    missingEnvVars,
  };
}

function normalizeCandidateProfile(candidateRow: EmailPreferenceCandidateRow) {
  return Array.isArray(candidateRow.profiles)
    ? (candidateRow.profiles[0] ?? null)
    : candidateRow.profiles;
}

async function fetchAutomatedEmailCandidates() {
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("email_preferences").select(
    `
      user_id,
      weekly_recap_enabled,
      marketing_emails_enabled,
      profiles!inner (
        user_id,
        username,
        display_currency,
        time_zone,
        last_app_activity_at
      )
    `,
  );

  if (error) {
    throw new Error(error.message);
  }

  return (
    (data as EmailPreferenceCandidateRow[] | null)?.flatMap((candidateRow) => {
      const profile = normalizeCandidateProfile(candidateRow);
      if (!profile) {
        return [];
      }

      return [
        {
          userId: candidateRow.user_id,
          username: profile.username,
          displayCurrency: profile.display_currency,
          timeZone: profile.time_zone,
          lastAppActivityAt: profile.last_app_activity_at,
          weeklyRecapEnabled: candidateRow.weekly_recap_enabled,
          marketingEmailsEnabled: candidateRow.marketing_emails_enabled,
        } satisfies AutomatedEmailCandidate,
      ];
    }) ?? []
  );
}

async function fetchRecentReengagementDeliveries(now: Date) {
  const supabase = createServiceClient();
  const cooldownCutoffTimestamp = new Date(
    now.getTime() - REENGAGEMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("automated_email_deliveries")
    .select("user_id, sent_at")
    .eq("email_type", "reengagement")
    .eq("status", "sent")
    .gte("sent_at", cooldownCutoffTimestamp)
    .order("sent_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const latestSentAtByUserId = new Map<string, string>();

  (data ?? []).forEach((deliveryRow) => {
    if (!deliveryRow.sent_at || latestSentAtByUserId.has(deliveryRow.user_id)) {
      return;
    }

    latestSentAtByUserId.set(deliveryRow.user_id, deliveryRow.sent_at);
  });

  return latestSentAtByUserId;
}

function buildDueAutomatedEmailJobs(params: {
  candidates: AutomatedEmailCandidate[];
  lastReengagementSentAtByUserId: Map<string, string>;
  now: Date;
  stats: AutomatedEmailCronStats;
}) {
  const { candidates, lastReengagementSentAtByUserId, now, stats } = params;
  const dueJobs: DueAutomatedEmailJob[] = [];

  candidates.forEach((candidate) => {
    const scheduleDecision = evaluateAutomatedEmailSchedule({
      timeZone: candidate.timeZone,
      weeklyRecapEnabled: candidate.weeklyRecapEnabled,
      marketingEmailsEnabled: candidate.marketingEmailsEnabled,
      lastAppActivityAt: candidate.lastAppActivityAt,
      lastReengagementSentAt:
        lastReengagementSentAtByUserId.get(candidate.userId) ?? null,
      now,
    });

    if (!scheduleDecision.selectedEmailType || !scheduleDecision.deliveryKey) {
      return;
    }

    if (scheduleDecision.weeklyRecapDue) {
      stats.weeklyDue += 1;
    }

    if (scheduleDecision.reengagementDue) {
      stats.reengagementDue += 1;
    }

    dueJobs.push({
      userId: candidate.userId,
      username: candidate.username,
      displayCurrency: candidate.displayCurrency,
      timeZone: candidate.timeZone,
      emailType: scheduleDecision.selectedEmailType,
      deliveryKey: scheduleDecision.deliveryKey,
    });
  });

  stats.dueUsers = dueJobs.length;

  return dueJobs;
}

async function processAutomatedEmailJob(params: {
  job: DueAutomatedEmailJob;
  recipientEmail: string;
  fromAddress: string;
  sender: ReturnType<typeof createAutomatedEmailSender>;
}) {
  const { fromAddress, job, recipientEmail, sender } = params;
  const supabase = createServiceClient();

  const digestResult = await buildAutomatedEmailDigest({
    profile: {
      user_id: job.userId,
      display_currency: job.displayCurrency,
      time_zone: job.timeZone,
    },
    positionsQueryContext: {
      supabaseClient: supabase,
      userId: job.userId,
    },
  });

  if (!digestResult.eligible) {
    return {
      success: true as const,
      skipped: true as const,
      reason: "no_active_positions",
    };
  }

  const renderedTemplate =
    job.emailType === "weekly_recap"
      ? await buildWeeklyRecapEmailTemplate({
          userId: job.userId,
          username: job.username,
          digest: digestResult.digest,
        })
      : await buildReengagementEmailTemplate({
          userId: job.userId,
          username: job.username,
          digest: digestResult.digest,
        });

  return sendAutomatedEmail({
    userId: job.userId,
    emailType: job.emailType,
    deliveryKey: job.deliveryKey,
    sender,
    message: {
      from: fromAddress,
      to: recipientEmail,
      subject: renderedTemplate.subject,
      html: renderedTemplate.html,
      text: renderedTemplate.text,
    },
  });
}

/**
 * Evaluate the current local-time window for every user and send due
 * automated emails in provider-friendly chunks.
 */
export async function runAutomatedEmailCron(
  now: Date = new Date(),
): Promise<RunAutomatedEmailCronResult> {
  const missingEnvVars = resolveMissingAutomatedEmailEnvVars();
  const baseStats = createBaseStats(now, missingEnvVars);

  if (process.env.AUTOMATED_EMAILS_ENABLED !== "true") {
    return {
      success: true,
      message: "Automated emails are disabled",
      stats: baseStats,
    };
  }

  if (missingEnvVars.length > 0) {
    return {
      success: true,
      message: "Automated emails skipped because configuration is incomplete",
      stats: baseStats,
    };
  }

  const fromAddress = resolveConfiguredFromAddress();
  if (!fromAddress) {
    return {
      success: true,
      message: "Automated emails skipped because configuration is incomplete",
      stats: baseStats,
    };
  }

  const [candidates, lastReengagementSentAtByUserId] = await Promise.all([
    fetchAutomatedEmailCandidates(),
    fetchRecentReengagementDeliveries(now),
  ]);

  const stats = {
    ...baseStats,
    scannedUsers: candidates.length,
  };
  const dueJobs = buildDueAutomatedEmailJobs({
    candidates,
    lastReengagementSentAtByUserId,
    now,
    stats,
  });

  if (dueJobs.length === 0) {
    return {
      success: true,
      message: "No automated emails were due",
      stats,
    };
  }

  const sender = createAutomatedEmailSender();

  for (const jobBatch of chunkArray(dueJobs, AUTOMATED_EMAIL_BATCH_SIZE)) {
    stats.batchCount += 1;

    const recipientEmailsByUserId = await fetchRecipientEmailsByUserId(
      jobBatch.map((job) => job.userId),
    );

    const batchResults = await Promise.all(
      jobBatch.map(async (job) => {
        const recipientEmail = recipientEmailsByUserId.get(job.userId);

        if (!recipientEmail) {
          return {
            success: true as const,
            skipped: true as const,
            reason: "no_email_address",
          };
        }

        try {
          return await processAutomatedEmailJob({
            job,
            recipientEmail,
            fromAddress,
            sender,
          });
        } catch (error) {
          return {
            success: false as const,
            errorMessage:
              error instanceof Error ? error.message : "Unknown send error",
          };
        }
      }),
    );

    batchResults.forEach((batchResult) => {
      if (batchResult.success && batchResult.skipped) {
        if (batchResult.reason === "no_email_address") {
          stats.skippedNoEmail += 1;
          return;
        }

        if (batchResult.reason === "no_active_positions") {
          stats.skippedNoActivePositions += 1;
          return;
        }

        if (batchResult.reason === "already_sent") {
          stats.skippedAlreadySent += 1;
        }

        return;
      }

      if (batchResult.success) {
        stats.sent += 1;
        return;
      }

      stats.failed += 1;
    });
  }

  return {
    success: true,
    message:
      stats.failed > 0
        ? "Automated email cron completed with partial failures"
        : "Automated email cron completed",
    stats,
  };
}
