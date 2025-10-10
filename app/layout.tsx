import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { ThemeProvider } from "@/components/features/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} antialiased transition-all`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Toaster />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
