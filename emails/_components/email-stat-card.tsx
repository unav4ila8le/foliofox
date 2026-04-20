import { Section, Text } from "@react-email/components";

import {
  EmailMutedText,
  emailColors,
  emailRadius,
} from "@/emails/_components/email-layout";

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
        padding: "16px",
      }}
    >
      <EmailMutedText style={{ fontSize: "14px", textTransform: "uppercase" }}>
        {label}
      </EmailMutedText>
      <Text
        style={{
          margin: "4px 0 0",
          fontSize: "20px",
          color: emailColors.foreground,
        }}
      >
        {value}
      </Text>
      {description ? (
        <EmailMutedText style={{ marginTop: "4px", fontSize: "14px" }}>
          {description}
        </EmailMutedText>
      ) : null}
    </Section>
  );
}
