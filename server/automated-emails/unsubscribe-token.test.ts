import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOMATED_EMAIL_PREFERENCE_KEYS } from "@/server/automated-emails/constants";

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signEncodedPayload(secret: string, encodedPayload: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

describe("unsubscribe token helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    process.env.EMAIL_LINK_SECRET = "test-email-link-secret";
  });

  it("creates and verifies a valid unsubscribe token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));

    const { createUnsubscribeToken, verifyUnsubscribeToken } =
      await import("./unsubscribe-token");

    const token = createUnsubscribeToken({
      userId: "user-1",
      preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.MARKETING_EMAILS,
      expiresInDays: 2,
    });
    const result = verifyUnsubscribeToken(token);

    expect(result).toEqual({
      valid: true,
      payload: {
        userId: "user-1",
        preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.MARKETING_EMAILS,
        expiresAt: "2026-04-19T12:00:00.000Z",
        version: 1,
      },
    });
  });

  it("rejects malformed but correctly signed payloads without throwing", async () => {
    const { verifyUnsubscribeToken } = await import("./unsubscribe-token");

    const malformedPayload = encodeBase64Url(
      JSON.stringify({
        userId: "user-1",
        preferenceKey: "not-a-real-preference",
        expiresAt: "2026-04-19T12:00:00.000Z",
        version: 1,
      }),
    );
    const signature = encodeBase64Url(
      signEncodedPayload(process.env.EMAIL_LINK_SECRET!, malformedPayload),
    );

    expect(verifyUnsubscribeToken(`${malformedPayload}.${signature}`)).toEqual({
      valid: false,
      reason: "invalid_format",
    });
  });

  it("rejects tokens with trailing segments", async () => {
    const { createUnsubscribeToken, verifyUnsubscribeToken } =
      await import("./unsubscribe-token");

    const token = createUnsubscribeToken({
      userId: "user-1",
      preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.WEEKLY_RECAP,
    });

    expect(verifyUnsubscribeToken(`${token}.extra`)).toEqual({
      valid: false,
      reason: "invalid_format",
    });
  });

  it("rejects expired tokens", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));

    const { createUnsubscribeToken, verifyUnsubscribeToken } =
      await import("./unsubscribe-token");

    const token = createUnsubscribeToken({
      userId: "user-1",
      preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.WEEKLY_RECAP,
      expiresInDays: 1,
    });

    vi.setSystemTime(new Date("2026-04-18T12:00:00.001Z"));

    expect(verifyUnsubscribeToken(token)).toEqual({
      valid: false,
      reason: "expired",
    });
  });
});
