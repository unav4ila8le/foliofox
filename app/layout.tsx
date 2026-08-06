import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { connection } from "next/server";
import { Suspense } from "react";

import { Toaster } from "@/components/ui/sonner";

import { LocaleProvider } from "@/components/features/locale/locale-provider";
import { PostHogAnalytics } from "@/components/features/posthog/posthog-analytics";
import { ThemeProvider } from "@/components/features/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import { resolveLocale } from "@/lib/locale/resolve-locale";
import { getOptionalUser } from "@/server/auth/actions";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const metadataBase = new URL(
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Foliofox - The AI-Powered Portfolio Intelligence Platform",
    template: "%s - Foliofox",
  },
  description:
    "Comprehensive portfolio tracking and AI-powered financial planning. Monitor your holdings, analyze performance, and discover growth opportunities with predictive insights tailored to your wealth-building strategy.",
};

// Streams as a sibling of the app tree so the analytics auth lookup never
// gates the UI. Request-time only: supabase auth calls Date.now(), which
// prerendering rejects.
async function PostHogIdentify() {
  await connection();
  const { user } = await getOptionalUser();
  return (
    <PostHogAnalytics user={user ? { id: user.id, email: user.email } : null} />
  );
}

// Async wrapper that resolves locale and wraps children
async function LocaleProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveLocale();
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} antialiased`}
    >
      <body>
        <Suspense>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <LocaleProviderWrapper>
              <Toaster />
              <TooltipProvider>{children}</TooltipProvider>
            </LocaleProviderWrapper>
          </ThemeProvider>
        </Suspense>
        <Suspense>
          <PostHogIdentify />
        </Suspense>
      </body>
    </html>
  );
}
