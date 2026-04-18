import { Link, Section, Text } from "@react-email/components";

import {
  EmailLayout,
  EmailMutedText,
  EmailSectionHeading,
  emailCardStyles,
} from "@/emails/_components/email-layout";
import { EmailStatCard } from "@/emails/_components/email-stat-card";
import { weeklyRecapPreviewProps } from "@/emails/_preview-data";
import {
  formatEmailCurrency,
  formatSignedEmailCurrency,
  formatSignedPercentage,
} from "@/emails/_lib/format";

import type { AutomatedEmailTemplateProps } from "@/emails/types";

function renderAssetLabel(name: string, symbol: string | null) {
  return symbol ? `${name} (${symbol})` : name;
}

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
          label="Projected income"
          value={formatEmailCurrency(
            digest.projectedIncome.nextThirtyDaysEstimate,
            digest.projectedIncome.currency,
          )}
          description={`Estimated over the next ${digest.projectedIncome.windowDays} days`}
        />
      ) : null}

      {digest.topMovers ? (
        <Section style={{ marginTop: "24px" }}>
          <EmailSectionHeading>Top movers</EmailSectionHeading>

          <Section style={emailCardStyles.wrapper}>
            <Text
              style={{
                margin: "0 0 10px",
                color: "#2c5b3b",
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Gainers
            </Text>
            {digest.topMovers.gainers.map((mover) => (
              <Text
                key={mover.asset.id}
                style={{
                  margin: "0 0 10px",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  color: "#121814",
                }}
              >
                <strong>
                  {renderAssetLabel(mover.asset.name, mover.asset.symbol)}
                </strong>
                {" · "}
                {formatSignedEmailCurrency(
                  mover.valueChangeAbs,
                  digest.currency,
                )}
                {" · "}
                {formatSignedPercentage(mover.valueChangePct)}
              </Text>
            ))}

            <Text
              style={{
                margin: "16px 0 10px",
                color: "#2c5b3b",
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Losers
            </Text>
            {digest.topMovers.losers.map((mover) => (
              <Text
                key={mover.asset.id}
                style={{
                  margin: "0 0 10px",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  color: "#121814",
                }}
              >
                <strong>
                  {renderAssetLabel(mover.asset.name, mover.asset.symbol)}
                </strong>
                {" · "}
                {formatSignedEmailCurrency(
                  mover.valueChangeAbs,
                  digest.currency,
                )}
                {" · "}
                {formatSignedPercentage(mover.valueChangePct)}
              </Text>
            ))}
          </Section>
        </Section>
      ) : null}

      {digest.projectedIncome ? (
        <Section style={{ marginTop: "24px" }}>
          <EmailSectionHeading>Upcoming income</EmailSectionHeading>
          <Section style={emailCardStyles.wrapper}>
            <EmailMutedText>
              Foliofox currently projects{" "}
              <strong>
                {formatEmailCurrency(
                  digest.projectedIncome.nextThirtyDaysEstimate,
                  digest.projectedIncome.currency,
                )}
              </strong>{" "}
              in income over the next {digest.projectedIncome.windowDays} days,
              based on your next {digest.projectedIncome.monthsAhead} months of
              projected payouts.
            </EmailMutedText>
          </Section>
        </Section>
      ) : (
        <Section style={{ marginTop: "24px" }}>
          <EmailSectionHeading>What to review next</EmailSectionHeading>
          <EmailMutedText>
            Open your dashboard to review position-level performance, update
            stale records, and see whether anything needs a closer look.
          </EmailMutedText>
        </Section>
      )}

      <Section style={{ marginTop: "24px" }}>
        <Text
          style={{
            margin: 0,
            fontSize: "14px",
            lineHeight: "1.6",
            color: "#5f6d62",
          }}
        >
          Prefer a different cadence? You can fine-tune this in{" "}
          <Link href={links.settingsUrl} style={{ color: "#2c5b3b" }}>
            your settings
          </Link>
          .
        </Text>
      </Section>
    </EmailLayout>
  );
}

WeeklyRecapEmail.PreviewProps = weeklyRecapPreviewProps;
