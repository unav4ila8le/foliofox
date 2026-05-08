import { Section } from "react-email";

import {
  EmailLayout,
  EmailSectionDivider,
  EmailSectionHeading,
} from "@/emails/_components/email-layout";
import { EmailMoverList } from "@/emails/_components/email-mover-list";
import { EmailStatCard } from "@/emails/_components/email-stat-card";
import { weeklyRecapPreviewProps } from "@/emails/_preview-data";
import {
  formatEmailCurrency,
  formatSignedEmailCurrency,
  formatSignedPercentage,
} from "@/emails/_lib/format";

import type { AutomatedEmailTemplateProps } from "@/emails/types";

export default function WeeklyRecapEmail({
  username,
  digest,
  links,
  reasonText,
}: AutomatedEmailTemplateProps) {
  const netWorthChangeLabel = formatSignedEmailCurrency(
    digest.netWorth.absoluteChange,
    digest.currency,
  );
  const netWorthChangeDescription = `${formatSignedPercentage(
    digest.netWorth.percentageChange,
  )} vs last week`;

  return (
    <EmailLayout
      previewText="Your Foliofox weekly recap is ready"
      title="Your weekly portfolio recap"
      subtitle={
        username
          ? `${username}, here is what moved across your portfolio this week.`
          : "Here is what moved across your portfolio this week."
      }
      dashboardUrl={links.dashboardUrl}
      dashboardLabel="Open dashboard"
      reasonText={reasonText}
      settingsUrl={links.settingsUrl}
      unsubscribeUrl={links.unsubscribeUrl}
      logoUrl={links.logoUrl}
    >
      <EmailStatCard
        label="Net worth"
        value={formatEmailCurrency(
          digest.netWorth.currentValue,
          digest.currency,
        )}
        description={`As of ${digest.netWorth.asOfDateKey}`}
      />
      <EmailStatCard
        label="Weekly change"
        value={netWorthChangeLabel}
        description={netWorthChangeDescription}
      />
      {digest.projectedIncome ? (
        <EmailStatCard
          label="Projected dividends"
          value={formatEmailCurrency(
            digest.projectedIncome.windowEstimate,
            digest.projectedIncome.currency,
          )}
          description={`Estimated over the next ${digest.projectedIncome.windowDays} days`}
        />
      ) : null}

      {digest.topMovers ? (
        <>
          <EmailSectionDivider />
          <Section>
            <EmailSectionHeading>Top movers</EmailSectionHeading>
            <EmailMoverList
              title="Gainers"
              movers={digest.topMovers.gainers}
              currency={digest.currency}
            />

            <EmailMoverList
              title="Losers"
              movers={digest.topMovers.losers}
              currency={digest.currency}
            />
          </Section>
        </>
      ) : null}
    </EmailLayout>
  );
}

WeeklyRecapEmail.PreviewProps = weeklyRecapPreviewProps;
