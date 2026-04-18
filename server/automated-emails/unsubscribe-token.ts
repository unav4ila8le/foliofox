import { createHmac, timingSafeEqual } from "node:crypto";

import {
  AUTOMATED_EMAIL_PREFERENCE_KEY_VALUES,
  DEFAULT_UNSUBSCRIBE_TOKEN_TTL_DAYS,
  type AutomatedEmailPreferenceKey,
} from "@/server/automated-emails/constants";

interface UnsubscribeTokenPayload {
  userId: string;
  preferenceKey: AutomatedEmailPreferenceKey;
  expiresAt: string;
  version: 1;
}

export type VerifiedUnsubscribeToken =
  | {
      valid: true;
      payload: UnsubscribeTokenPayload;
    }
  | {
      valid: false;
      reason: "invalid_format" | "invalid_signature" | "expired";
    };

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function resolveEmailLinkSecret() {
  const emailLinkSecret = process.env.EMAIL_LINK_SECRET?.trim();

  if (!emailLinkSecret) {
    throw new Error("Missing EMAIL_LINK_SECRET for unsubscribe tokens");
  }

  return emailLinkSecret;
}

function signTokenPayload(encodedPayload: string) {
  return createHmac("sha256", resolveEmailLinkSecret())
    .update(encodedPayload)
    .digest();
}

function isValidUnsubscribeTokenPayload(
  value: unknown,
): value is UnsubscribeTokenPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Partial<UnsubscribeTokenPayload>;

  return (
    typeof payload.userId === "string" &&
    payload.userId.trim().length > 0 &&
    typeof payload.preferenceKey === "string" &&
    AUTOMATED_EMAIL_PREFERENCE_KEY_VALUES.includes(payload.preferenceKey) &&
    typeof payload.expiresAt === "string" &&
    payload.expiresAt.trim().length > 0 &&
    payload.version === 1
  );
}

/**
 * Create a signed unsubscribe token for a specific preference category.
 */
export function createUnsubscribeToken(input: {
  userId: string;
  preferenceKey: AutomatedEmailPreferenceKey;
  expiresInDays?: number;
}) {
  const expiresInDays = Math.max(
    1,
    Math.trunc(input.expiresInDays ?? DEFAULT_UNSUBSCRIBE_TOKEN_TTL_DAYS),
  );
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const payload: UnsubscribeTokenPayload = {
    userId: input.userId,
    preferenceKey: input.preferenceKey,
    expiresAt,
    version: 1,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const encodedSignature = encodeBase64Url(signTokenPayload(encodedPayload));

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Verify a signed unsubscribe token and return its payload when valid.
 */
export function verifyUnsubscribeToken(
  token: string,
): VerifiedUnsubscribeToken {
  const tokenSegments = token.split(".");

  if (tokenSegments.length !== 2) {
    return {
      valid: false,
      reason: "invalid_format",
    };
  }

  const [encodedPayload, encodedSignature] = tokenSegments;

  if (!encodedPayload || !encodedSignature) {
    return {
      valid: false,
      reason: "invalid_format",
    };
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  const actualSignature = Buffer.from(encodedSignature, "base64url");

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return {
      valid: false,
      reason: "invalid_signature",
    };
  }

  let parsedPayload: UnsubscribeTokenPayload;

  try {
    const decodedPayload = decodeBase64Url(encodedPayload);
    const rawPayload = JSON.parse(decodedPayload) as unknown;

    if (!isValidUnsubscribeTokenPayload(rawPayload)) {
      return {
        valid: false,
        reason: "invalid_format",
      };
    }

    parsedPayload = rawPayload;
  } catch {
    return {
      valid: false,
      reason: "invalid_format",
    };
  }

  const expiresAtTimestamp = new Date(parsedPayload.expiresAt).getTime();

  if (Number.isNaN(expiresAtTimestamp) || expiresAtTimestamp <= Date.now()) {
    return {
      valid: false,
      reason: "expired",
    };
  }

  return {
    valid: true,
    payload: parsedPayload,
  };
}
