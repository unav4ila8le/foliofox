import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { PostHogProvider } from "@/components/features/posthog/posthog-provider";
import { ThemeProvider } from "@/components/features/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import { getOptionalUser } from "@/server/auth/actions";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Foliofox - Portfolio Intelligence Platform",
  description:
    "Comprehensive portfolio tracking and AI-powered financial planning. Monitor your holdings, analyze performance, and discover growth opportunities with predictive insights tailored to your wealth-building strategy.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get optional user for PostHog identification
  const { user } = await getOptionalUser();
  const userData = user
    ? {
        id: user.id,
        email: user.email,
      }
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} antialiased transition-all`}>
        <PostHogProvider user={userData}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Toaster />
            {children}
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
