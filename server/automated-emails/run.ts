"use server";

import { chunkArray } from "@/server/shared/chunk-array";
import { createServiceClient } from "@/supabase/service";
import { buildAutomatedEmailDigest } from "@/server/automated-emails/digest";
import {
  isAutomatedEmailDeliveryAlreadySent,
  sendAutomatedEmailBatch,
} from "@/server/automated-emails/deliveries";
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

type PreparedAutomatedEmailJobResult =
  | {
      ready: true;
      input: {
        userId: string;
        emailType: "weekly_recap" | "reengagement";
        deliveryKey: string;
        message: {
          from: string;
          to: string;
          subject: string;
          html: string;
          text: string;
        };
      };
    }
  | {
      ready: false;
      result:
        | {
            success: true;
            skipped: true;
            reason: "already_sent" | "no_active_positions" | "no_email_address";
          }
        | {
            success: false;
            errorMessage: string;
          };
    };

interface AutomatedEmailCronTimingsMs {
  total: number;
  loadCandidates: number;
  scheduleEvaluation: number;
  recipientLookup: number;
  digestAndTemplatePreparation: number;
  providerSend: number;
}

type AutomatedEmailCronTimingKey = Exclude<
  keyof AutomatedEmailCronTimingsMs,
  "total"
>;

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
  timingsMs: AutomatedEmailCronTimingsMs;
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

function createEmptyTimings(): AutomatedEmailCronTimingsMs {
  return {
    total: 0,
    loadCandidates: 0,
    scheduleEvaluation: 0,
    recipientLookup: 0,
    digestAndTemplatePreparation: 0,
    providerSend: 0,
  };
}

function resolveElapsedMs(startedAtMs: number) {
  return Math.round((performance.now() - startedAtMs) * 100) / 100;
}

async function measureCronTiming<T>(params: {
  stats: AutomatedEmailCronStats;
  key: AutomatedEmailCronTimingKey;
  operation: () => Promise<T>;
}) {
  const startedAtMs = performance.now();

  try {
    return await params.operation();
  } finally {
    params.stats.timingsMs[params.key] += resolveElapsedMs(startedAtMs);
  }
}

function finalizeCronStats(
  stats: AutomatedEmailCronStats,
  cronStartedAtMs: number,
) {
  stats.timingsMs.total = resolveElapsedMs(cronStartedAtMs);
  return stats;
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
    timingsMs: createEmptyTimings(),
  };
}

/**
 * Supabase relation typings can return the joined `profiles` row as either an
 * object or a single-element array depending on inference context. Normalize
 * to a single profile or null so callers do not branch on shape.
 */
function normalizeCandidateProfile(candidateRow: EmailPreferenceCandidateRow) {
  return Array.isArray(candidateRow.profiles)
    ? (candidateRow.profiles[0] ?? null)
    : candidateRow.profiles;
}

/**
 * Load every user with an email-preferences row joined to profile fields the
 * scheduler needs (timezone, currency, last activity). Runs as the service
 * role so RLS does not need to allow cross-user reads.
 */
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

/**
 * Build a `userId -> latest sent_at` map for re-engagement deliveries inside
 * the cooldown window. Used by the scheduler to enforce the 21-day cooldown
 * without requiring per-user delivery lookups.
 */
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

/**
 * Run the schedule rules across every candidate and return the ordered list
 * of jobs that should attempt delivery this run. Updates the running stats
 * with weekly/reengagement/dueUsers counters as a side-effect.
 */
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

/**
 * Prepare one due job for delivery: dedupe, build the digest, and render the
 * matching template. Provider sending happens once per prepared batch so the
 * cron does not burst past Resend's request rate limit.
 */
async function prepareAutomatedEmailJob(params: {
  job: DueAutomatedEmailJob;
  recipientEmail: string;
  fromAddress: string;
}): Promise<PreparedAutomatedEmailJobResult> {
  const { fromAddress, job, recipientEmail } = params;

  // 1. Short-circuit before any heavy work when this user has already received
  // the email for the current local window (e.g. a same-hour cron retry).
  const alreadySent = await isAutomatedEmailDeliveryAlreadySent({
    userId: job.userId,
    emailType: job.emailType,
    deliveryKey: job.deliveryKey,
  });

  if (alreadySent) {
    return {
      ready: false as const,
      result: {
        success: true as const,
        skipped: true as const,
        reason: "already_sent" as const,
      },
    };
  }

  const supabase = createServiceClient();

  // 2. Build the analytics payload only after the dedupe check passes.
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
      ready: false as const,
      result: {
        success: true as const,
        skipped: true as const,
        reason: "no_active_positions" as const,
      },
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

  return {
    ready: true as const,
    input: {
      userId: job.userId,
      emailType: job.emailType,
      deliveryKey: job.deliveryKey,
      message: {
        from: fromAddress,
        to: recipientEmail,
        subject: renderedTemplate.subject,
        html: renderedTemplate.html,
        text: renderedTemplate.text,
      },
    },
  };
}

/**
 * Evaluate the current local-time window for every user and send due
 * automated emails in provider-friendly chunks.
 */
export async function runAutomatedEmailCron(
  now: Date = new Date(),
): Promise<RunAutomatedEmailCronResult> {
  const cronStartedAtMs = performance.now();
  const missingEnvVars = resolveMissingAutomatedEmailEnvVars();
  const baseStats = createBaseStats(now, missingEnvVars);

  if (process.env.AUTOMATED_EMAILS_ENABLED !== "true") {
    return {
      success: true,
      message: "Automated emails are disabled",
      stats: finalizeCronStats(baseStats, cronStartedAtMs),
    };
  }

  if (missingEnvVars.length > 0) {
    return {
      success: true,
      message: "Automated emails skipped because configuration is incomplete",
      stats: finalizeCronStats(baseStats, cronStartedAtMs),
    };
  }

  const fromAddress = resolveConfiguredFromAddress();
  if (!fromAddress) {
    return {
      success: true,
      message: "Automated emails skipped because configuration is incomplete",
      stats: finalizeCronStats(baseStats, cronStartedAtMs),
    };
  }

  const stats = baseStats;
  const [candidates, lastReengagementSentAtByUserId] = await measureCronTiming({
    stats,
    key: "loadCandidates",
    operation: () =>
      Promise.all([
        fetchAutomatedEmailCandidates(),
        fetchRecentReengagementDeliveries(now),
      ]),
  });

  stats.scannedUsers = candidates.length;

  const dueJobs = await measureCronTiming({
    stats,
    key: "scheduleEvaluation",
    operation: async () =>
      buildDueAutomatedEmailJobs({
        candidates,
        lastReengagementSentAtByUserId,
        now,
        stats,
      }),
  });

  if (dueJobs.length === 0) {
    return {
      success: true,
      message: "No automated emails were due",
      stats: finalizeCronStats(stats, cronStartedAtMs),
    };
  }

  const sender = createAutomatedEmailSender();

  for (const jobBatch of chunkArray(dueJobs, AUTOMATED_EMAIL_BATCH_SIZE)) {
    stats.batchCount += 1;

    const recipientEmailsByUserId = await measureCronTiming({
      stats,
      key: "recipientLookup",
      operation: () =>
        fetchRecipientEmailsByUserId(jobBatch.map((job) => job.userId)),
    });

    const preparedBatchResults = await measureCronTiming({
      stats,
      key: "digestAndTemplatePreparation",
      operation: () =>
        Promise.all(
          jobBatch.map(async (job) => {
            const recipientEmail = recipientEmailsByUserId.get(job.userId);

            if (!recipientEmail) {
              return {
                ready: false as const,
                result: {
                  success: true as const,
                  skipped: true as const,
                  reason: "no_email_address" as const,
                },
              };
            }

            try {
              return await prepareAutomatedEmailJob({
                job,
                recipientEmail,
                fromAddress,
              });
            } catch (error) {
              return {
                ready: false as const,
                result: {
                  success: false as const,
                  errorMessage:
                    error instanceof Error
                      ? error.message
                      : "Unknown send error",
                },
              };
            }
          }),
        ),
    });
    const sendInputs = preparedBatchResults.flatMap((preparedBatchResult) =>
      preparedBatchResult.ready ? [preparedBatchResult.input] : [],
    );
    const sendResults = await measureCronTiming({
      stats,
      key: "providerSend",
      operation: () =>
        sendAutomatedEmailBatch({
          items: sendInputs,
          sender,
        }),
    });
    const batchResults = [
      ...preparedBatchResults.flatMap((preparedBatchResult) =>
        preparedBatchResult.ready ? [] : [preparedBatchResult.result],
      ),
      ...sendResults,
    ];

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
    stats: finalizeCronStats(stats, cronStartedAtMs),
  };
}
