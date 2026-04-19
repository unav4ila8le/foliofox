"use server";

import { render } from "@react-email/render";
import type { ReactElement } from "react";

import ReengagementEmail from "@/emails/re-engagement";
import WeeklyRecapEmail from "@/emails/weekly-recap";
import {
  AUTOMATED_EMAIL_PREFERENCE_DETAILS,
  AUTOMATED_EMAIL_PREFERENCE_KEYS,
  type AutomatedEmailPreferenceKey,
} from "@/server/automated-emails/constants";
import { createUnsubscribeToken } from "@/server/automated-emails/unsubscribe-token";
import { resolveSiteUrl } from "@/server/shared/site-url";

import type { AutomatedEmailDigest } from "@/server/automated-emails/digest";
import type { AutomatedEmailTemplateLinks } from "@/emails/types";

interface BuildAutomatedEmailTemplateInput {
  userId: string;
  username?: string | null;
  digest: AutomatedEmailDigest;
}

export interface RenderedAutomatedEmailTemplate {
  subject: string;
  html: string;
  text: string;
  links: AutomatedEmailTemplateLinks;
}

async function resolveAutomatedEmailLinks(params: {
  userId: string;
  preferenceKey: AutomatedEmailPreferenceKey;
}) {
  const siteUrl = await resolveSiteUrl({
    requireConfiguredPublicUrl: true,
  });
  const unsubscribeToken = createUnsubscribeToken({
    userId: params.userId,
    preferenceKey: params.preferenceKey,
  });

  return {
    dashboardUrl: `${siteUrl}/dashboard`,
    settingsUrl: `${siteUrl}/dashboard?settings=emails`,
    unsubscribeUrl: `${siteUrl}/unsubscribe?token=${encodeURIComponent(
      unsubscribeToken,
    )}`,
  };
}

async function renderTemplateEmail(
  template: ReactElement,
): Promise<Pick<RenderedAutomatedEmailTemplate, "html" | "text">> {
  const html = await render(template);
  const text = await render(template, {
    plainText: true,
  });

  return {
    html,
    text,
  };
}

/**
 * Render the weekly recap email into HTML and plain text so any delivery
 * provider can send the same payload.
 */
export async function buildWeeklyRecapEmailTemplate(
  input: BuildAutomatedEmailTemplateInput,
): Promise<RenderedAutomatedEmailTemplate> {
  const links = await resolveAutomatedEmailLinks({
    userId: input.userId,
    preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.WEEKLY_RECAP,
  });
  const template = (
    <WeeklyRecapEmail
      username={input.username}
      digest={input.digest}
      links={links}
      reasonText={
        AUTOMATED_EMAIL_PREFERENCE_DETAILS[
          AUTOMATED_EMAIL_PREFERENCE_KEYS.WEEKLY_RECAP
        ].reasonText
      }
    />
  );
  const renderedTemplate = await renderTemplateEmail(template);

  return {
    subject: "Your Foliofox weekly recap",
    links,
    ...renderedTemplate,
  };
}

/**
 * Render the re-engagement email into HTML and plain text so the send layer
 * stays transport-focused.
 */
export async function buildReengagementEmailTemplate(
  input: BuildAutomatedEmailTemplateInput,
): Promise<RenderedAutomatedEmailTemplate> {
  const links = await resolveAutomatedEmailLinks({
    userId: input.userId,
    preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.MARKETING_EMAILS,
  });
  const template = (
    <ReengagementEmail
      username={input.username}
      digest={input.digest}
      links={links}
      reasonText={
        AUTOMATED_EMAIL_PREFERENCE_DETAILS[
          AUTOMATED_EMAIL_PREFERENCE_KEYS.MARKETING_EMAILS
        ].reasonText
      }
    />
  );
  const renderedTemplate = await renderTemplateEmail(template);

  return {
    subject: "A quick portfolio check-in from Foliofox",
    links,
    ...renderedTemplate,
  };
}
