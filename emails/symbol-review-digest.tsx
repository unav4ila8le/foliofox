import { Link, Section, Text } from "react-email";

import {
  EmailLayout,
  EmailMutedText,
  EmailSectionDivider,
  EmailSectionHeading,
  emailColors,
  emailRadius,
} from "@/emails/_components/email-layout";
import { symbolReviewDigestPreviewProps } from "@/emails/_preview-data";
import {
  buildRetirementSql,
  groupDigestEntries,
} from "@/server/symbol-review/helpers";

import type { DigestEntry } from "@/server/symbol-review/helpers";

export interface SymbolReviewDigestEmailProps {
  entries: DigestEntry[];
  logoUrl: string;
}

// Deliberately system-monospace: the SQL block is meant to be selected and
// pasted, and a webfont would not load in most mail clients anyway.
const monospaceFontFamily =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

function SymbolReviewEntry({ entry }: { entry: DigestEntry }) {
  return (
    <Section style={{ marginBottom: "24px" }}>
      <Text
        style={{
          margin: "0 0 2px",
          fontSize: "16px",
          color: emailColors.foreground,
        }}
      >
        <strong>{entry.aliasValue}</strong>
        {entry.displayName ? ` — ${entry.displayName}` : null}
      </Text>

      <EmailMutedText style={{ fontSize: "13px", marginBottom: "8px" }}>
        {entry.exchange ?? "Unknown exchange"} · {entry.confidence} confidence
      </EmailMutedText>

      <Text style={{ margin: "0 0 8px", fontSize: "14px" }}>
        {entry.summary}
      </Text>

      {entry.verdict === "renamed" && entry.successorTicker ? (
        <Text style={{ margin: "0 0 8px", fontSize: "14px" }}>
          Successor ticker: <strong>{entry.successorTicker}</strong>. Renames
          are multi-step and user-visible — follow the playbook in{" "}
          <code style={{ fontFamily: monospaceFontFamily }}>
            docs/SYMBOL-RENAME-HANDLING.md
          </code>
          .
        </Text>
      ) : null}

      {entry.evidenceUrls.length ? (
        <Section style={{ marginBottom: "8px" }}>
          {entry.evidenceUrls.map((url) => (
            <EmailMutedText key={url} style={{ fontSize: "12px" }}>
              <Link href={url} style={{ color: emailColors.brand }}>
                {url}
              </Link>
            </EmailMutedText>
          ))}
        </Section>
      ) : null}

      {/*
        Deliberately a plain <pre>, not react-email's <CodeBlock>. CodeBlock
        separates highlighted tokens with zero-width joiners, which survive
        into the plain-text rendering and into anything the operator copies —
        pasting the "highlighted" SQL into psql yields invisible garbage
        between every keyword. Syntax colour is not worth breaking the one
        thing this block exists for.
      */}
      {entry.verdict === "retired" ? (
        <pre
          style={{
            margin: 0,
            padding: "12px",
            backgroundColor: emailColors.pageBackground,
            border: `1px solid ${emailColors.border}`,
            borderRadius: emailRadius.nested,
            fontFamily: monospaceFontFamily,
            fontSize: "12px",
            lineHeight: 1.5,
            color: emailColors.foreground,
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {buildRetirementSql(entry)}
        </pre>
      ) : null}
    </Section>
  );
}

export default function SymbolReviewDigestEmail({
  entries,
  logoUrl,
}: SymbolReviewDigestEmailProps) {
  const groups = groupDigestEntries(entries);

  return (
    <EmailLayout
      previewText={`${entries.length} stale symbol${entries.length === 1 ? "" : "s"} reviewed`}
      title="Stale symbol review"
      subtitle="Research only — nothing has been applied. Run the SQL below yourself after checking the evidence."
      logoUrl={logoUrl}
    >
      {groups.map((group, index) => (
        <Section key={group.verdict}>
          {index > 0 ? <EmailSectionDivider /> : null}
          <EmailSectionHeading style={{ marginBottom: "16px" }}>
            {group.heading}
          </EmailSectionHeading>
          {group.entries.map((entry) => (
            <SymbolReviewEntry key={entry.aliasId} entry={entry} />
          ))}
        </Section>
      ))}
    </EmailLayout>
  );
}

SymbolReviewDigestEmail.PreviewProps = symbolReviewDigestPreviewProps;
