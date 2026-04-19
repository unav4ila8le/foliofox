import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { ReactNode } from "react";

interface EmailLayoutProps {
  previewText: string;
  title: string;
  subtitle: string;
  dashboardUrl: string;
  dashboardLabel: string;
  reasonText: string;
  settingsUrl: string;
  unsubscribeUrl: string;
  children: ReactNode;
}

// Shared palette and typography for every automated email template. These are
// inline style values (not Tailwind tokens) because email clients require fully
// resolved CSS. Keep all template-level color and font usage routed through
// these exports so a future styling pass updates one source of truth.
export const emailColors = {
  background: "#f6f7f4",
  card: "#ffffff",
  border: "#dadfd4",
  foreground: "#121814",
  muted: "#5f6d62",
  accent: "#2c5b3b",
  accentSoft: "#e7f0e9",
} as const;

export const emailFontFamily =
  "Manrope, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

export function EmailLayout({
  previewText,
  title,
  subtitle,
  dashboardUrl,
  dashboardLabel,
  reasonText,
  settingsUrl,
  unsubscribeUrl,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          margin: 0,
          backgroundColor: emailColors.background,
          color: emailColors.foreground,
          fontFamily: emailFontFamily,
          padding: "32px 16px",
        }}
      >
        <Container
          style={{
            maxWidth: "620px",
            margin: "0 auto",
          }}
        >
          <Section
            style={{
              backgroundColor: emailColors.card,
              border: `1px solid ${emailColors.border}`,
              borderRadius: "24px",
              padding: "28px",
              boxShadow: "0 8px 24px rgba(18, 24, 20, 0.06)",
            }}
          >
            <Text
              style={{
                margin: "0 0 10px",
                color: emailColors.accent,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Foliofox
            </Text>

            <Heading
              as="h1"
              style={{
                margin: "0 0 12px",
                fontSize: "32px",
                lineHeight: "1.1",
                color: emailColors.foreground,
              }}
            >
              {title}
            </Heading>

            <Text
              style={{
                margin: "0 0 24px",
                fontSize: "16px",
                lineHeight: "1.6",
                color: emailColors.muted,
              }}
            >
              {subtitle}
            </Text>

            {children}

            <Section style={{ marginTop: "28px", textAlign: "left" }}>
              <Button
                href={dashboardUrl}
                style={{
                  display: "inline-block",
                  borderRadius: "999px",
                  backgroundColor: emailColors.accent,
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  padding: "12px 20px",
                  textDecoration: "none",
                }}
              >
                {dashboardLabel}
              </Button>
            </Section>

            <Hr
              style={{
                margin: "28px 0 20px",
                borderColor: emailColors.border,
              }}
            />

            <Text
              style={{
                margin: "0 0 12px",
                fontSize: "13px",
                lineHeight: "1.6",
                color: emailColors.muted,
              }}
            >
              {reasonText}
            </Text>

            <Text
              style={{
                margin: 0,
                fontSize: "13px",
                lineHeight: "1.6",
                color: emailColors.muted,
              }}
            >
              <Link href={settingsUrl} style={{ color: emailColors.accent }}>
                Manage email settings
              </Link>
              {" · "}
              <Link href={unsubscribeUrl} style={{ color: emailColors.accent }}>
                Unsubscribe from this email type
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailSectionHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h2"
      style={{
        margin: "0 0 12px",
        fontSize: "18px",
        lineHeight: "1.3",
        color: emailColors.foreground,
      }}
    >
      {children}
    </Heading>
  );
}

export function EmailMutedText({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: 0,
        fontSize: "14px",
        lineHeight: "1.6",
        color: emailColors.muted,
      }}
    >
      {children}
    </Text>
  );
}

export const emailCardStyles = {
  wrapper: {
    backgroundColor: emailColors.accentSoft,
    borderRadius: "18px",
    padding: "18px",
  },
  compactList: {
    margin: "0 0 12px",
  },
} as const;
