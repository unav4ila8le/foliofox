import { Text } from "@react-email/components";

import { emailColors } from "@/emails/_components/email-layout";
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
  /** Top margin in px applied to the list title; defaults to 0. */
  titleTopMarginPx?: number;
}

/**
 * Render a small uppercase title and a vertical list of mover lines.
 * Used by the weekly recap to render the Gainers and Losers blocks with the
 * same markup and styling.
 */
export function EmailMoverList({
  title,
  movers,
  currency,
  titleTopMarginPx = 0,
}: EmailMoverListProps) {
  if (movers.length === 0) {
    return null;
  }

  return (
    <>
      <Text
        style={{
          margin: `${titleTopMarginPx}px 0 10px`,
          color: emailColors.foreground,
          fontSize: "12px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </Text>
      {movers.map((mover) => (
        <Text
          key={mover.asset.id}
          style={{
            margin: "0 0 8px",
            fontSize: "14px",
            lineHeight: "1.6",
            color: emailColors.foreground,
          }}
        >
          <strong>
            {renderEmailAssetLabel(mover.asset.name, mover.asset.symbol)}
          </strong>
          {" · "}
          {formatSignedEmailCurrency(mover.valueChangeAbs, currency)}
          {" · "}
          {formatSignedPercentage(mover.valueChangePct)}
        </Text>
      ))}
    </>
  );
}
