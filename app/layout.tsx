import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Suspense } from "react";

import { PostHogProvider } from "@/components/features/posthog/posthog-provider";
import { ThemeProvider } from "@/components/features/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import { getOptionalUser } from "@/server/auth/actions";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "Foliofox - The AI-Powered Portfolio Intelligence Platform",
    template: "%s - Foliofox",
  },
  description:
    "Comprehensive portfolio tracking and AI-powered financial planning. Monitor your holdings, analyze performance, and discover growth opportunities with predictive insights tailored to your wealth-building strategy.",
};

async function PostHogUserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get optional user for PostHog identification
  const { user } = await getOptionalUser();
  const userData = user
    ? {
        id: user.id,
        email: user.email,
      }
    : null;
  return <PostHogProvider user={userData}>{children}</PostHogProvider>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} antialiased`}>
        <Suspense>
          <PostHogUserProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <Toaster />
              {children}
            </ThemeProvider>
          </PostHogUserProvider>
        </Suspense>
      </body>
    </html>
  );
}
