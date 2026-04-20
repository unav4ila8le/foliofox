import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
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
  logoUrl: string;
  children: ReactNode;
}

// NOTE: These values mirror the Foliofox design tokens in app/globals.css.
// Email clients can't reliably resolve CSS custom properties (var(--...)),
// so we hard-code the literal equivalents here. When any token in the
// :root { ... } block in globals.css changes, update the matching entry
// below so the email palette stays in sync with the app.
//
// Matching tokens:
//   pageBackground -> --secondary (oklch(0.97 0.01 38.76))
//   cardBackground -> --background / --card (oklch(1 0 0))
//   border         -> slightly lighter than --border for a softer feel
//   foreground     -> --foreground (oklch(0.145 0 0))
//   muted          -> --muted-foreground (oklch(0.556 0 0))
//   brand          -> --brand (oklch(0.67 0.131 38.76))
//   radius         -> --radius (0.625rem)
export const emailColors = {
  pageBackground: "#fcf3f0",
  cardBackground: "#ffffff",
  border: "#efefef",
  foreground: "#0a0a0a",
  muted: "#737373",
  brand: "#d87656",
} as const;

export const emailRadius = {
  card: "10px",
  nested: "4px",
} as const;

// Deliberately system-only. Installing a webfont raises weight and fails in
// Outlook/Android Gmail anyway; sans-serif fallbacks render consistently.
export const emailFontFamily =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Logo is 561x137 native; displayed at 1/4 scale for crisp retina rendering.
const LOGO_DISPLAY_WIDTH = 140;
const LOGO_DISPLAY_HEIGHT = 34;

export function EmailLayout({
  previewText,
  title,
  subtitle,
  dashboardUrl,
  dashboardLabel,
  reasonText,
  settingsUrl,
  unsubscribeUrl,
  logoUrl,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          margin: 0,
          backgroundColor: emailColors.pageBackground,
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
              backgroundColor: emailColors.cardBackground,
              border: `1px solid ${emailColors.border}`,
              borderRadius: emailRadius.card,
              padding: "32px",
            }}
          >
            <Img
              src={logoUrl}
              width={LOGO_DISPLAY_WIDTH}
              height={LOGO_DISPLAY_HEIGHT}
              alt="Foliofox"
              style={{
                display: "block",
                margin: "0 0 28px",
                border: 0,
                outline: "none",
                textDecoration: "none",
              }}
            />

            <Heading
              as="h1"
              style={{
                margin: "0 0 12px",
                fontSize: "28px",
                lineHeight: "1.2",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: emailColors.foreground,
              }}
            >
              {title}
            </Heading>

            <Text
              style={{
                margin: "0 0 28px",
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
                  borderRadius: emailRadius.card,
                  backgroundColor: emailColors.brand,
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "12px 22px",
                  textDecoration: "none",
                  letterSpacing: "-0.01em",
                }}
              >
                {dashboardLabel}
              </Button>
            </Section>

            <Hr
              style={{
                margin: "32px 0 20px",
                border: 0,
                borderTop: `1px solid ${emailColors.border}`,
              }}
            />

            <Text
              style={{
                margin: "0 0 10px",
                fontSize: "12px",
                lineHeight: "1.6",
                color: emailColors.muted,
              }}
            >
              {reasonText}
            </Text>

            <Text
              style={{
                margin: 0,
                fontSize: "12px",
                lineHeight: "1.6",
                color: emailColors.muted,
              }}
            >
              <Link
                href={settingsUrl}
                style={{
                  color: emailColors.brand,
                  textDecoration: "underline",
                }}
              >
                Manage email settings
              </Link>
              {" · "}
              <Link
                href={unsubscribeUrl}
                style={{
                  color: emailColors.brand,
                  textDecoration: "underline",
                }}
              >
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
        fontWeight: 700,
        letterSpacing: "-0.01em",
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

// Hairline horizontal rule used to separate content sections inside the card.
// Mirrors the editorial spacing rhythm of the Foliofox marketing emails.
export function EmailSectionDivider() {
  return (
    <Hr
      style={{
        margin: "28px 0",
        border: 0,
        borderTop: `1px solid ${emailColors.border}`,
      }}
    />
  );
}
