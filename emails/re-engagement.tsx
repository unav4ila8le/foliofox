import { Section } from "@react-email/components";

import {
  EmailLayout,
  EmailMutedText,
  EmailSectionDivider,
  EmailSectionHeading,
} from "@/emails/_components/email-layout";
import { EmailStatCard } from "@/emails/_components/email-stat-card";
import { reengagementPreviewProps } from "@/emails/_preview-data";
import {
  formatEmailCurrency,
  formatSignedEmailCurrency,
  formatSignedPercentage,
  renderEmailAssetLabel,
} from "@/emails/_lib/format";

import type { AutomatedEmailTemplateProps } from "@/emails/types";

function resolveStrongestMover(digest: AutomatedEmailTemplateProps["digest"]) {
  if (!digest.topMovers) {
    return null;
  }

  const candidates = [...digest.topMovers.gainers, ...digest.topMovers.losers];

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((strongest, current) =>
    Math.abs(current.valueChangeAbs) > Math.abs(strongest.valueChangeAbs)
      ? current
      : strongest,
  );
}

export default function ReengagementEmail({
  username,
  digest,
  links,
  reasonText,
}: AutomatedEmailTemplateProps) {
  const strongestMover = resolveStrongestMover(digest);

  return (
    <EmailLayout
      previewText="Your portfolio has changed since your last visit"
      title="A quick portfolio check-in"
      subtitle={
        username
          ? `${username}, your portfolio has moved since your last visit.`
          : "Your portfolio has moved since your last visit."
      }
      dashboardUrl={links.dashboardUrl}
      dashboardLabel="Review your dashboard"
      reasonText={reasonText}
      settingsUrl={links.settingsUrl}
      unsubscribeUrl={links.unsubscribeUrl}
      logoUrl={links.logoUrl}
    >
      <EmailStatCard
        label="Net worth today"
        value={formatEmailCurrency(
          digest.netWorth.currentValue,
          digest.currency,
        )}
        description={`${formatSignedEmailCurrency(digest.netWorth.absoluteChange, digest.currency)} (${formatSignedPercentage(digest.netWorth.percentageChange)})`}
      />

      {strongestMover ? (
        <EmailStatCard
          label="Strongest mover"
          value={renderEmailAssetLabel(
            strongestMover.asset.name,
            strongestMover.asset.symbol,
          )}
          description={`${formatSignedEmailCurrency(strongestMover.valueChangeAbs, digest.currency)} (${formatSignedPercentage(strongestMover.valueChangePct)})`}
        />
      ) : null}

      {digest.projectedIncome ? (
        <EmailStatCard
          label={`Next ${digest.projectedIncome.windowDays} days`}
          value={formatEmailCurrency(
            digest.projectedIncome.windowEstimate,
            digest.projectedIncome.currency,
          )}
          description="Projected portfolio dividends income"
        />
      ) : null}

      <EmailSectionDivider />

      <Section>
        <EmailSectionHeading>
          A lot has changed since you last signed in
        </EmailSectionHeading>
        <EmailMutedText>
          Make sure you have your finances under control. A quick visit to the
          dashboard or a short chat with Foliofox AI advisor will help you get
          back on track.
        </EmailMutedText>
      </Section>
    </EmailLayout>
  );
}

ReengagementEmail.PreviewProps = reengagementPreviewProps;
