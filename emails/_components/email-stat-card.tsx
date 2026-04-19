import { Section, Text } from "@react-email/components";

import { emailColors } from "@/emails/_components/email-layout";

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
        marginBottom: "12px",
        border: `1px solid ${emailColors.border}`,
        borderRadius: "18px",
        padding: "16px",
      }}
    >
      <Text
        style={{
          margin: "0 0 6px",
          color: emailColors.muted,
          fontSize: "13px",
          lineHeight: "1.4",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 700,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          margin: "0 0 6px",
          color: emailColors.foreground,
          fontSize: "24px",
          lineHeight: "1.2",
          fontWeight: 700,
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
