import { Section, Text } from "@react-email/components";

import { emailColors, emailRadius } from "@/emails/_components/email-layout";

interface EmailStatCardProps {
  label: string;
  value: string;
  description?: string;
}

export function EmailStatCard({
  label,
  value,
  description,
}: EmailStatCardProps) {
  return (
    <Section
      style={{
        marginBottom: "10px",
        border: `1px solid ${emailColors.border}`,
        borderRadius: emailRadius.nested,
        padding: "14px 16px",
      }}
    >
      <Text
        style={{
          margin: "0 0 4px",
          color: emailColors.muted,
          fontSize: "12px",
          lineHeight: "1.4",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          margin: "0 0 4px",
          color: emailColors.foreground,
          fontSize: "22px",
          lineHeight: "1.2",
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </Text>
      {description ? (
        <Text
          style={{
            margin: 0,
            color: emailColors.muted,
            fontSize: "13px",
            lineHeight: "1.5",
          }}
        >
          {description}
        </Text>
      ) : null}
    </Section>
  );
}
