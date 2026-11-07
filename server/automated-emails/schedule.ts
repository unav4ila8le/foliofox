import {
  AUTOMATED_EMAIL_SEND_HOUR_LOCAL,
  REENGAGEMENT_COOLDOWN_DAYS,
  REENGAGEMENT_INACTIVITY_DAYS,
} from "@/server/automated-emails/constants";
import {
  formatDateKeyInTimeZone,
  parseUTCDateKey,
  type CivilDateKey,
} from "@/lib/date/date-utils";

import type { Database } from "@/types/database.types";

type AutomatedEmailType = Database["public"]["Enums"]["automated_email_type"];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface AutomatedEmailScheduleInput {
  userId: string;
  timeZone: string;
  weeklyRecapEnabled: boolean;
  marketingEmailsEnabled: boolean;
  lastAppActivityAt: string | null;
  lastReengagementSentAt: string | null;
  now?: Date;
}

export interface AutomatedEmailScheduleDecision {
  localDateKey: CivilDateKey;
  localHour: number;
  weeklyRecapDue: boolean;
  reengagementDue: boolean;
  selectedEmailType: AutomatedEmailType | null;
  deliveryKey: string | null;
}

function resolveLocalHour(date: Date, timeZone: string) {
  // Locale only governs digit shaping for the `hour` part, which we parse as
  // an integer below; "en-US" is just an explicit anchor for that.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  const hourPart = formatter
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;

  if (!hourPart) {
    throw new Error("Failed to resolve local hour for automated emails");
  }

  const parsedHour = Number(hourPart);
  if (!Number.isInteger(parsedHour)) {
    throw new Error("Invalid local hour resolved for automated emails");
  }

  return parsedHour;
}

/**
 * Fixed weekday (0 = Sunday … 6 = Saturday) a user receives the weekly recap.
 * Supabase user IDs are random UUIDs, so their trailing hex spreads users
 * roughly evenly across the week and keeps each user's day stable, which keeps
 * daily send volume flat instead of spiking on one weekday.
 */
export function resolveWeeklyRecapWeekday(userId: string) {
  return Number.parseInt(userId.slice(-8), 16) % 7;
}

function isWeeklyRecapDay(dateKey: CivilDateKey, userId: string) {
  return (
    parseUTCDateKey(dateKey).getUTCDay() === resolveWeeklyRecapWeekday(userId)
  );
}

function resolveLocalDateKey(timestamp: string, timeZone: string) {
  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return null;
  }

  return formatDateKeyInTimeZone(parsedTimestamp, timeZone);
}

/**
 * Whole civil days between two `CivilDateKey` values. Both keys are parsed at
 * UTC midnight so DST shifts in any user-local timezone never bias the count.
 */
function differenceInCivilDays(
  laterDateKey: CivilDateKey,
  earlierDateKey: CivilDateKey,
) {
  const laterTimestamp = parseUTCDateKey(laterDateKey).getTime();
  const earlierTimestamp = parseUTCDateKey(earlierDateKey).getTime();

  return Math.floor((laterTimestamp - earlierTimestamp) / MS_PER_DAY);
}

/**
 * Evaluate which automated email, if any, should send for a user right now.
 * The hourly cron uses a local 9 AM send window (on the user's assigned
 * weekday for the weekly recap) and civil-day comparisons so email cadence
 * stays predictable in the user's timezone.
 */
export function evaluateAutomatedEmailSchedule(
  input: AutomatedEmailScheduleInput,
): AutomatedEmailScheduleDecision {
  const now = input.now ?? new Date();
  const localDateKey = formatDateKeyInTimeZone(now, input.timeZone);
  const localHour = resolveLocalHour(now, input.timeZone);
  const isSendHour = localHour === AUTOMATED_EMAIL_SEND_HOUR_LOCAL;

  const weeklyRecapDue =
    input.weeklyRecapEnabled &&
    isSendHour &&
    isWeeklyRecapDay(localDateKey, input.userId);

  let reengagementDue = false;

  if (
    input.marketingEmailsEnabled &&
    isSendHour &&
    input.lastAppActivityAt &&
    !weeklyRecapDue
  ) {
    const lastActivityDateKey = resolveLocalDateKey(
      input.lastAppActivityAt,
      input.timeZone,
    );

    // Inactivity and cooldown are measured in user-local civil days, not
    // 24-hour blocks. So "14 inactive days" really means 14 calendar days
    // have passed since the user's last activity in their own timezone.
    if (
      lastActivityDateKey &&
      differenceInCivilDays(localDateKey, lastActivityDateKey) >=
        REENGAGEMENT_INACTIVITY_DAYS
    ) {
      const lastReengagementDateKey = input.lastReengagementSentAt
        ? resolveLocalDateKey(input.lastReengagementSentAt, input.timeZone)
        : null;

      reengagementDue =
        !lastReengagementDateKey ||
        differenceInCivilDays(localDateKey, lastReengagementDateKey) >=
          REENGAGEMENT_COOLDOWN_DAYS;
    }
  }

  if (weeklyRecapDue) {
    return {
      localDateKey,
      localHour,
      weeklyRecapDue: true,
      reengagementDue: false,
      selectedEmailType: "weekly_recap",
      deliveryKey: `weekly:${localDateKey}`,
    };
  }

  if (reengagementDue) {
    return {
      localDateKey,
      localHour,
      weeklyRecapDue: false,
      reengagementDue: true,
      selectedEmailType: "reengagement",
      deliveryKey: `reengagement:${localDateKey}`,
    };
  }

  return {
    localDateKey,
    localHour,
    weeklyRecapDue: false,
    reengagementDue: false,
    selectedEmailType: null,
    deliveryKey: null,
  };
}
