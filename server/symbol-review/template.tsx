"use server";

import { render } from "react-email";

import SymbolReviewDigestEmail from "@/emails/symbol-review-digest";
import { resolveSiteUrl } from "@/server/shared/site-url";

import { buildDigestSubject } from "./helpers";

import type { DigestEntry } from "./helpers";

export interface RenderedSymbolReviewDigest {
  subject: string;
  html: string;
  text: string;
}

/**
 * Render the operator digest to html + plain text, mirroring
 * `server/automated-emails/templates.tsx`.
 */
export async function buildSymbolReviewDigestEmail(
  entries: DigestEntry[],
): Promise<RenderedSymbolReviewDigest> {
  // Best-effort, unlike user-facing mail: this digest must still send on a
  // self-hosted instance that never set NEXT_PUBLIC_SITE_URL. Only the logo
  // depends on it, and a missing image is not worth losing the digest over.
  const siteUrl = await resolveSiteUrl();

  const template = (
    <SymbolReviewDigestEmail
      entries={entries}
      logoUrl={`${siteUrl}/images/foliofox-logo.png`}
    />
  );

  return {
    subject: buildDigestSubject(entries),
    html: await render(template),
    text: await render(template, { plainText: true }),
  };
}
