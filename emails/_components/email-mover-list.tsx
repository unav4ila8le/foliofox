import { Section, Text } from "react-email";

import {
  EmailMutedText,
  emailColors,
  emailRadius,
} from "@/emails/_components/email-layout";
import {
  formatSignedEmailCurrency,
  formatSignedPercentage,
  renderEmailAssetLabel,
} from "@/emails/_lib/format";

import type { AutomatedEmailDigestTopMovers } from "@/server/automated-emails/digest";

type Mover =
  | AutomatedEmailDigestTopMovers["gainers"][number]
  | AutomatedEmailDigestTopMovers["losers"][number];

interface EmailMoverListProps {
  title: string;
  movers: Mover[];
  currency: string;
}

/**
 * Render a small title and a vertical list of mover lines.
 * Used by the weekly recap to render the Gainers and Losers blocks with the
 * same markup and styling.
 */
export function EmailMoverList({
  title,
  movers,
  currency,
}: EmailMoverListProps) {
  if (movers.length === 0) {
    return null;
  }

  return (
    <Section
      style={{
        marginBottom: "12px",
        border: `1px solid ${emailColors.border}`,
        borderRadius: emailRadius.nested,
        padding: "16px",
      }}
    >
      <EmailMutedText
        style={{
          marginBottom: "8px",
          fontSize: "14px",
          textTransform: "uppercase",
        }}
      >
        {title}
      </EmailMutedText>
      {movers.map((mover) => (
        <Text
          key={mover.asset.id}
          style={{
            margin: "0 0 8px",
            fontSize: "14px",
            color: emailColors.foreground,
          }}
        >
          <strong>
            {renderEmailAssetLabel(mover.asset.name, mover.asset.symbol)}
          </strong>
          <br />
          {formatSignedEmailCurrency(mover.valueChangeAbs, currency)} (
          {formatSignedPercentage(mover.valueChangePct)})
        </Text>
      ))}
    </Section>
  );
}
